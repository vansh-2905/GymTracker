// Coach chat as a streaming Edge Function (Deno runtime).
//
// Why an edge function: regular Netlify functions buffer the whole response
// and are killed at ~10s, which data-heavy coach questions kept hitting.
// Edge functions stream — the client sees tokens as Claude produces them and
// time spent waiting on upstream responses doesn't count against the limit.
//
// Why no firebase-admin: the Admin SDK is Node-only and doesn't run on Deno.
// Instead we verify the Firebase ID token against Google's public JWKS with
// Web Crypto, and read/write Firestore through its REST API using an OAuth
// token minted from the service account.
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '../lib/utils.ts'

declare const Netlify: { env: { get(key: string): string | undefined } }

const SERVICE_ACCOUNT = JSON.parse(
  Netlify.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}'
) as { project_id: string; client_email: string; private_key: string }

const PROJECT_ID = SERVICE_ACCOUNT.project_id
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const anthropic = new Anthropic({ apiKey: Netlify.env.get('ANTHROPIC_API_KEY') ?? '' })

const ALLOWED_ORIGIN = Netlify.env.get('ALLOWED_ORIGIN') ?? '*'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RATE_LIMIT_PER_HOUR = 30

// ---------- base64url / crypto helpers ----------

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 ? '='.repeat(4 - (padded.length % 4)) : ''
  return Uint8Array.from(atob(padded + pad), c => c.charCodeAt(0))
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const strToB64url = (s: string) => bytesToB64url(new TextEncoder().encode(s))

// ---------- Firebase ID token verification ----------

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let jwksCache: { keys: (JsonWebKey & { kid?: string })[]; fetchedAt: number } | null = null

async function getFirebaseJwk(kid: string): Promise<JsonWebKey | null> {
  if (!jwksCache || Date.now() - jwksCache.fetchedAt > 60 * 60 * 1000) {
    const res = await fetch(FIREBASE_JWKS_URL)
    if (!res.ok) return null
    jwksCache = { keys: (await res.json()).keys, fetchedAt: Date.now() }
  }
  return jwksCache.keys.find(k => k.kid === kid) ?? null
}

// Returns the uid, or null if the token is invalid.
async function verifyIdToken(idToken: string): Promise<string | null> {
  try {
    const parts = idToken.split('.')
    if (parts.length !== 3) return null
    const dec = new TextDecoder()
    const header = JSON.parse(dec.decode(b64urlToBytes(parts[0]))) as { alg?: string; kid?: string }
    const payload = JSON.parse(dec.decode(b64urlToBytes(parts[1]))) as {
      aud?: string; iss?: string; sub?: string; exp?: number
    }
    if (header.alg !== 'RS256' || !header.kid) return null
    const jwk = await getFirebaseJwk(header.kid)
    if (!jwk) return null
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    )
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    )
    if (!valid) return null
    if (payload.aud !== PROJECT_ID) return null
    if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    return payload.sub
  } catch {
    return null
  }
}

// ---------- Google OAuth token for Firestore REST ----------

let accessTokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt - 60_000) {
    return accessTokenCache.token
  }
  const now = Math.floor(Date.now() / 1000)
  const header = strToB64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = strToB64url(JSON.stringify({
    iss: SERVICE_ACCOUNT.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const pemBody = SERVICE_ACCOUNT.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pemBody), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)
  )
  const assertion = `${header}.${claims}.${bytesToB64url(new Uint8Array(signature))}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  accessTokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

// ---------- Firestore REST helpers ----------

interface FsValue {
  stringValue?: string
  integerValue?: string
  doubleValue?: number
  booleanValue?: boolean
  nullValue?: null
  timestampValue?: string
  mapValue?: { fields?: Record<string, FsValue> }
  arrayValue?: { values?: FsValue[] }
}

function decodeValue(v: FsValue): unknown {
  if (v.stringValue !== undefined) return v.stringValue
  if (v.integerValue !== undefined) return Number(v.integerValue)
  if (v.doubleValue !== undefined) return v.doubleValue
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.timestampValue !== undefined) return v.timestampValue
  if (v.mapValue) return decodeFields(v.mapValue.fields ?? {})
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(decodeValue)
  return null
}

function decodeFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v)
  return out
}

function encodeValue(v: unknown): FsValue {
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  return { nullValue: null }
}

async function fsGetDoc(path: string): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken()
  const res = await fetch(`${FS_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore get ${path}: ${res.status}`)
  const json = (await res.json()) as { fields?: Record<string, FsValue> }
  return decodeFields(json.fields ?? {})
}

async function fsListDocs(path: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const token = await getAccessToken()
  const out: { id: string; data: Record<string, unknown> }[] = []
  let pageToken = ''
  do {
    const url = `${FS_BASE}/${path}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Firestore list ${path}: ${res.status}`)
    const json = (await res.json()) as {
      documents?: { name: string; fields?: Record<string, FsValue> }[]
      nextPageToken?: string
    }
    for (const d of json.documents ?? []) {
      out.push({ id: d.name.split('/').pop()!, data: decodeFields(d.fields ?? {}) })
    }
    pageToken = json.nextPageToken ?? ''
  } while (pageToken)
  return out
}

async function fsSetDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const token = await getAccessToken()
  const fields: Record<string, FsValue> = {}
  for (const [k, v] of Object.entries(data)) fields[k] = encodeValue(v)
  const res = await fetch(`${FS_BASE}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`Firestore set ${path}: ${res.status}`)
}

// ---------- rate limit ----------

async function checkRateLimit(uid: string): Promise<boolean> {
  const path = `users/${uid}/data/rateLimit`
  const now = Date.now()
  const windowMs = 60 * 60 * 1000
  try {
    const doc = await fsGetDoc(path)
    const windowStart = typeof doc?.windowStart === 'number' ? doc.windowStart : 0
    const count = typeof doc?.count === 'number' ? doc.count : 0
    if (!doc || now - windowStart > windowMs) {
      await fsSetDoc(path, { count: 1, windowStart: now })
      return true
    }
    if (count >= RATE_LIMIT_PER_HOUR) return false
    await fsSetDoc(path, { count: count + 1, windowStart })
    return true
  } catch {
    // fail open on rate limit errors to avoid blocking legitimate requests
    return true
  }
}

// ---------- coach tools ----------

const tools: Anthropic.Tool[] = [
  {
    name: 'getWorkoutDay',
    description:
      'Get the workout metadata and all sets for a specific date. Returns every field on every set (reps, weight, activeDuration, restDuration, kcal, exerciseName, etc). Use for questions about a specific day.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      },
      required: ['date'],
    },
  },
  {
    name: 'getWorkoutsInRange',
    description:
      'Get all workouts and their complete raw sets between two dates (inclusive). Use for weekly/monthly summaries, overtraining analysis, PPL balance, streaks, volume trends.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD (inclusive)' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD (inclusive)' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'getExerciseHistory',
    description:
      'Get all logged sets for a specific exercise across all time, most recent first, grouped by date. Use for PRs, progress tracking, plateau detection, volume progression.',
    input_schema: {
      type: 'object' as const,
      properties: {
        exerciseName: {
          type: 'string',
          description: 'Exercise name (case-insensitive partial match)',
        },
        limit: {
          type: 'number',
          description: 'Max workout sessions to return (default 20)',
        },
      },
      required: ['exerciseName'],
    },
  },
]

// Tool results are sent to the model as JSON — keep only the fields the
// schema documents so payloads stay small.
function slimSet(data: Record<string, unknown>): Record<string, unknown> {
  const { exerciseName, setNumber, reps, weight, sides, isTimed, activeDuration, restDuration, kcal } = data
  return { exerciseName, setNumber, reps, weight, sides, isTimed, activeDuration, restDuration, kcal }
}

function slimWorkout(date: string, data: Record<string, unknown>): Record<string, unknown> {
  return { date, type: data.type, completed: data.completed }
}

async function getSlimSets(uid: string, date: string): Promise<Record<string, unknown>[]> {
  const docs = await fsListDocs(`users/${uid}/workouts/${date}/sets`)
  return docs.map(d => slimSet(d.data))
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  uid: string
): Promise<unknown> {
  if (name === 'getWorkoutDay') {
    const date = input['date'] as string
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Invalid date format' }
    const workout = await fsGetDoc(`users/${uid}/workouts/${date}`)
    if (!workout) return { workout: null, sets: [] }
    const sets = await getSlimSets(uid, date)
    return { workout: slimWorkout(date, workout), sets }
  }

  if (name === 'getWorkoutsInRange') {
    const startDate = input['startDate'] as string
    const endDate = input['endDate'] as string
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return { error: 'Invalid date format' }
    }
    const all = await fsListDocs(`users/${uid}/workouts`)
    const inRange = all.filter(d => d.id >= startDate && d.id <= endDate)
    return Promise.all(
      inRange.map(async d => ({
        ...slimWorkout(d.id, d.data),
        sets: await getSlimSets(uid, d.id),
      }))
    )
  }

  if (name === 'getExerciseHistory') {
    const exerciseName = (input['exerciseName'] as string).toLowerCase()
    const limit = Math.min((input['limit'] as number | undefined) ?? 20, 50)
    const all = await fsListDocs(`users/${uid}/workouts`)
    const sortedDates = all
      .map(d => d.id)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 60)
    const byDate = await Promise.all(
      sortedDates.map(async date => ({
        date,
        sets: (await getSlimSets(uid, date)).filter(
          s => typeof s.exerciseName === 'string' && s.exerciseName.toLowerCase().includes(exerciseName)
        ),
      }))
    )
    return byDate.filter(r => r.sets.length > 0).slice(0, limit)
  }

  return { error: `Unknown tool: ${name}` }
}

// ---------- handler ----------

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS })
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  let parsed: { idToken?: unknown; message?: unknown; history?: unknown }
  try {
    parsed = await request.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }
  const { idToken, message, history } = parsed

  if (!idToken || typeof idToken !== 'string') {
    return jsonResponse(401, { error: 'Unauthorized' })
  }
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return jsonResponse(400, { error: 'Message must be a non-empty string under 2000 characters' })
  }
  if (!Array.isArray(history) || history.length > 100) {
    return jsonResponse(400, { error: 'Invalid history' })
  }
  for (const entry of history as { role?: unknown; content?: unknown }[]) {
    if (
      (entry.role !== 'user' && entry.role !== 'assistant') ||
      typeof entry.content !== 'string' ||
      entry.content.length > 4000
    ) {
      return jsonResponse(400, { error: 'Invalid history entry' })
    }
  }

  const uid = await verifyIdToken(idToken)
  if (!uid) return jsonResponse(401, { error: 'Unauthorized' })

  const allowed = await checkRateLimit(uid)
  if (!allowed) {
    return jsonResponse(429, { error: 'Rate limit exceeded. Try again in an hour.' })
  }

  const profileDocs = await Promise.all([
    fsGetDoc(`users/${uid}/data/profile`),
    fsGetDoc(`users/${uid}/data/fitnessProfile`),
  ]).catch(err => {
    console.error('Coach profile fetch error:', err)
    return null
  })
  if (!profileDocs) return jsonResponse(500, { error: 'Internal server error' })
  const [profile, fitness] = profileDocs

  const today = new Date().toLocaleDateString('en-CA')
  const systemPrompt = buildSystemPrompt(profile ?? {}, fitness, today)

  const trimmedHistory = (history as { role: 'user' | 'assistant'; content: string }[]).slice(-20)
  const messages: Anthropic.MessageParam[] = [
    ...trimmedHistory.map(m => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
    { role: 'user', content: message },
  ]

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let emittedAny = false
      try {
        for (let turn = 0; turn < 6; turn++) {
          let emittedThisTurn = false
          const claudeStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: systemPrompt,
            tools,
            messages,
          })
          claudeStream.on('text', delta => {
            if (!emittedThisTurn) {
              if (emittedAny) controller.enqueue(encoder.encode('\n\n'))
              emittedThisTurn = true
              emittedAny = true
            }
            controller.enqueue(encoder.encode(delta))
          })
          const final = await claudeStream.finalMessage()
          if (final.stop_reason !== 'tool_use') break

          const toolUseBlocks = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )
          const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
            toolUseBlocks.map(async block => ({
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify(
                await executeTool(block.name, block.input as Record<string, unknown>, uid)
              ),
            }))
          )
          messages.push({ role: 'assistant', content: final.content })
          messages.push({ role: 'user', content: toolResults })
        }
      } catch (err) {
        console.error('Coach stream error:', err)
        controller.enqueue(
          encoder.encode(`${emittedAny ? '\n\n' : ''}Something went wrong — try again.`)
        )
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export const config = { path: '/api/coach' }

import type { Handler } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import * as admin from 'firebase-admin'
import { buildSystemPrompt } from './utils'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)
    ),
  })
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const db = admin.firestore()

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? '*'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RATE_LIMIT_PER_HOUR = 30

async function checkRateLimit(uid: string): Promise<boolean> {
  const ref = db.doc(`users/${uid}/data/rateLimit`)
  const now = Date.now()
  const windowMs = 60 * 60 * 1000

  try {
    const snap = await ref.get()
    if (!snap.exists) {
      await ref.set({ count: 1, windowStart: now })
      return true
    }

    const data = snap.data()!
    const windowStart: number =
      typeof data.windowStart === 'number' ? data.windowStart : data.windowStart.toMillis()

    if (now - windowStart > windowMs) {
      await ref.set({ count: 1, windowStart: now })
      return true
    }

    if ((data.count as number) >= RATE_LIMIT_PER_HOUR) return false

    await ref.update({ count: admin.firestore.FieldValue.increment(1) })
    return true
  } catch {
    // fail open on rate limit errors to avoid blocking legitimate requests
    return true
  }
}

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

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  uid: string
): Promise<unknown> {
  if (name === 'getWorkoutDay') {
    const date = input['date'] as string
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Invalid date format' }
    const workoutSnap = await db.doc(`users/${uid}/workouts/${date}`).get()
    if (!workoutSnap.exists) return { workout: null, sets: [] }
    const setsSnap = await db.collection(`users/${uid}/workouts/${date}/sets`).get()
    const sets = setsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    return { workout: { date, ...workoutSnap.data() }, sets }
  }

  if (name === 'getWorkoutsInRange') {
    const startDate = input['startDate'] as string
    const endDate = input['endDate'] as string
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return { error: 'Invalid date format' }
    }
    const workoutsSnap = await db.collection(`users/${uid}/workouts`).get()
    const inRange = workoutsSnap.docs.filter(d => d.id >= startDate && d.id <= endDate)
    const results = await Promise.all(
      inRange.map(async workoutDoc => {
        const setsSnap = await db
          .collection(`users/${uid}/workouts/${workoutDoc.id}/sets`)
          .get()
        const sets = setsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        return { date: workoutDoc.id, ...workoutDoc.data(), sets }
      })
    )
    return results.sort((a, b) => (a.date as string).localeCompare(b.date as string))
  }

  if (name === 'getExerciseHistory') {
    const exerciseName = (input['exerciseName'] as string).toLowerCase()
    const limit = Math.min((input['limit'] as number | undefined) ?? 20, 50)
    const workoutsSnap = await db.collection(`users/${uid}/workouts`).get()
    const sortedDates = workoutsSnap.docs
      .map(d => d.id)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 200)

    const results: { date: string; sets: unknown[] }[] = []
    for (const date of sortedDates) {
      if (results.length >= limit) break
      const setsSnap = await db.collection(`users/${uid}/workouts/${date}/sets`).get()
      const matching = setsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => {
          const name = (s as Record<string, unknown>)['exerciseName']
          return typeof name === 'string' && name.toLowerCase().includes(exerciseName)
        })
      if (matching.length > 0) results.push({ date, sets: matching })
    }
    return results
  }

  return { error: `Unknown tool: ${name}` }
}

export const handler: Handler = async event => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method not allowed' }
  }

  try {
    const { idToken, message, history } = JSON.parse(event.body ?? '{}') as {
      idToken: string
      message: string
      history: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!idToken || typeof idToken !== 'string') {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    if (!message || typeof message !== 'string' || message.length > 2000) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Message must be a non-empty string under 2000 characters' }) }
    }
    if (!Array.isArray(history) || history.length > 100) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid history' }) }
    }
    for (const entry of history) {
      if (
        (entry.role !== 'user' && entry.role !== 'assistant') ||
        typeof entry.content !== 'string' ||
        entry.content.length > 4000
      ) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid history entry' }) }
      }
    }

    const decoded = await admin.auth().verifyIdToken(idToken)
    const uid = decoded.uid

    const allowed = await checkRateLimit(uid)
    if (!allowed) {
      return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Rate limit exceeded. Try again in an hour.' }) }
    }

    const [profileSnap, fitnessSnap] = await Promise.all([
      db.doc(`users/${uid}/data/profile`).get(),
      db.doc(`users/${uid}/data/fitnessProfile`).get(),
    ])

    const today = new Date().toLocaleDateString('en-CA')
    const systemPrompt = buildSystemPrompt(
      profileSnap.data() ?? {},
      fitnessSnap.exists ? (fitnessSnap.data() ?? null) : null,
      today
    )

    const trimmedHistory = history.slice(-20)
    const messages: Anthropic.MessageParam[] = [
      ...trimmedHistory.map(m => ({ role: m.role, content: m.content } as Anthropic.MessageParam)),
      { role: 'user', content: message },
    ]

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    })

    let toolLoopCount = 0
    while (response.stop_reason === 'tool_use' && toolLoopCount < 5) {
      toolLoopCount++
      const toolUseBlocks = response.content.filter(
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
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages,
      })
    }

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    }
  } catch (err) {
    console.error('Coach function error:', err)
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

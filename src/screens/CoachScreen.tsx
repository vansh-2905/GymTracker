import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { useAuth } from '../auth/AuthContext'
import { db } from '../firebase'
import type { ChatMessage } from '../types'

const SUGGESTIONS = [
  'AM I OVERTRAINING?',
  'WHAT ARE MY MAINTENANCE CALORIES?',
  'SHOW MY BENCH PROGRESS',
  'HOW WAS THIS WEEK?',
]

function messagesCol(uid: string) {
  return collection(db, 'users', uid, 'coachMessages')
}

type MessagesCache = { uid: string; messages: ChatMessage[] }
let _messagesCache: MessagesCache | null = null

export default function CoachScreen() {
  const { user } = useAuth()
  const uid = user!.uid
  const cachedMsgs = _messagesCache?.uid === uid ? _messagesCache.messages : null

  const [messages, setMessages] = useState<ChatMessage[]>(cachedMsgs ?? [])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [initialLoading, setInitialLoading] = useState(cachedMsgs === null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ignore = false
    async function loadHistory() {
      const q = query(messagesCol(uid), orderBy('createdAt', 'asc'), limit(50))
      const snap = await getDocs(q)
      if (!ignore) {
        const loaded: ChatMessage[] = snap.docs.map(d => ({
          id: d.id,
          role: d.data()['role'] as 'user' | 'assistant',
          content: d.data()['content'] as string,
          createdAt: d.data()['createdAt']?.toDate?.() ?? new Date(),
        }))
        _messagesCache = { uid, messages: loaded }
        setMessages(loaded)
        setInitialLoading(false)
      }
    }
    loadHistory()
    return () => { ignore = true }
  }, [uid])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function send(text: string) {
    if (!text.trim() || sending) return
    const userMsg: ChatMessage = { role: 'user', content: text.trim() }

    await addDoc(messagesCol(uid), { ...userMsg, createdAt: serverTimestamp() })
    setMessages(prev => {
      const next = [...prev, userMsg]
      _messagesCache = { uid, messages: next }
      return next
    })
    setInput('')
    setSending(true)

    function appendAssistant(content: string) {
      setMessages(prev => {
        const next: ChatMessage[] = [...prev, { role: 'assistant', content }]
        _messagesCache = { uid, messages: next }
        return next
      })
    }
    function replaceLastAssistant(content: string) {
      setMessages(prev => {
        const next: ChatMessage[] = [...prev.slice(0, -1), { role: 'assistant', content }]
        _messagesCache = { uid, messages: next }
        return next
      })
    }

    try {
      const idToken = await user!.getIdToken()
      const history = [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, message: text.trim(), history }),
      })
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        appendAssistant(data?.error ?? 'Something went wrong — try again.')
        return
      }

      // The edge function streams the reply as plain text — render it as it arrives
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let reply = ''
      let started = false
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (!chunk) continue
        reply += chunk
        if (started) replaceLastAssistant(reply)
        else {
          started = true
          appendAssistant(reply)
        }
      }
      reply = (reply + decoder.decode()).trim()

      if (!reply) {
        if (started) replaceLastAssistant('Something went wrong — try again.')
        else appendAssistant('Something went wrong — try again.')
        return
      }
      replaceLastAssistant(reply)
      await addDoc(messagesCol(uid), { role: 'assistant', content: reply, createdAt: serverTimestamp() })
    } catch {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: 'Something went wrong — try again.',
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setSending(false)
    }
  }

  async function clearChat() {
    if (!confirm('Clear all chat history?')) return
    const snap = await getDocs(messagesCol(uid))
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
    _messagesCache = { uid, messages: [] }
    setMessages([])
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-iron-950">
        <div className="w-8 h-8 border-2 border-acid border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-iron-950 flex flex-col overflow-hidden animate-screen-in" style={{ height: 'calc(100dvh - 5rem)' }}>
      <div className="h-0.5 w-full bg-acid" />

      {/* Header */}
      <div className="flex justify-between items-start px-5 pt-10 pb-4">
        <div>
          <h1 className="font-display text-5xl text-white leading-none">CHAT</h1>
          <p className="font-mono text-iron-500 text-[10px] tracking-widest uppercase mt-1">
            Ask about your workouts
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="font-mono text-iron-500 text-[10px] uppercase tracking-wider hover:text-iron-300 transition-colors mt-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {messages.length === 0 && !sending ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 pb-10">
            <p className="font-mono text-iron-600 text-[10px] tracking-widest uppercase mb-2">
              Ask anything
            </p>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="w-full border border-iron-700 px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-iron-300 hover:border-acid hover:text-acid transition-colors text-left"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div
                key={m.id ?? i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 font-sans text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-acid text-black'
                      : 'bg-iron-800 text-white'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-0.5">{children}</li>,
                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        h2: ({ children }) => <p className="font-bold text-[13px] uppercase tracking-wide mt-3 mb-1">{children}</p>,
                        h3: ({ children }) => <p className="font-bold mt-2 mb-1">{children}</p>,
                        table: ({ children }) => <table className="w-full text-xs border-collapse my-2">{children}</table>,
                        th: ({ children }) => <th className="border border-iron-600 px-2 py-1 text-left font-mono uppercase text-[10px]">{children}</th>,
                        td: ({ children }) => <td className="border border-iron-600 px-2 py-1">{children}</td>,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : m.content}
                </div>
              </div>
            ))}
            {sending && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-iron-800 px-4 py-3 flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-iron-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-iron-800 px-4 py-3 flex gap-3 bg-iron-950">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder="Ask anything..."
          className="flex-1 bg-iron-900 border border-iron-700 px-4 py-3 font-mono text-sm text-white placeholder-iron-600 focus:outline-none focus:border-acid transition-colors"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || sending}
          className="px-4 py-3 bg-acid text-black font-mono text-[11px] uppercase tracking-widest disabled:opacity-40 transition-opacity"
        >
          →
        </button>
      </div>
    </div>
  )
}

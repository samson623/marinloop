/**
 * ChatWidget — floating chat assistant.
 * Replaces the standalone mic FAB + voice bubble with a slide-up panel that
 * supports both typed messages and voice input via the existing useVoiceIntent hook.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MicIcon } from '@/shared/components/icons'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
}

export interface ChatWidgetProps {
  voiceBubble: string
  voiceActive: boolean
  handleVoice: () => void
  processVoice: (text: string) => Promise<void>
}

// ── Constants ──────────────────────────────────────────────────────────────────

const THINKING = new Set(['Thinking…', 'Thinking...'])
const LISTENING = new Set(['Listening…', 'Listening...'])

function isStatus(text: string) {
  return !text || THINKING.has(text) || LISTENING.has(text)
}

const SUGGESTIONS = [
  'When is my next dose?',
  "What's my adherence this week?",
  'Log my medication',
  'When is my next appointment?',
]

let _id = 0
function nextId() { return String(++_id) }

// ── Component ──────────────────────────────────────────────────────────────────

export function ChatWidget({ voiceBubble, voiceActive, handleVoice, processVoice }: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastBubble = useRef('')
  const voiceTranscript = useRef('')
  const awaitingReply = useRef(false)

  // ── Message helpers ────────────────────────────────────────────────────────

  const addMessage = useCallback((role: ChatMessage['role'], text: string) => {
    setMessages(prev => [...prev, { id: nextId(), role, text }])
  }, [])

  // ── voiceBubble watcher ────────────────────────────────────────────────────
  // Translates the hook's string-based bubble state into chat thread messages.

  useEffect(() => {
    const prev = lastBubble.current
    const curr = voiceBubble
    if (prev === curr) return
    lastBubble.current = curr

    // While recording: track the live transcript so we can add it as a user message
    if (voiceActive && curr && !isStatus(curr)) {
      voiceTranscript.current = curr
    }

    // Intentional setState-in-effect: voiceBubble is external state produced by the voice
    // recognition system (SpeechRecognition + AI service). This effect is the correct place
    // to translate that external stream of status strings into chat thread messages and
    // thinking/open state — there is no equivalent event-driven alternative.

    // Entering Thinking phase
    if (THINKING.has(curr) && !THINKING.has(prev)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsThinking(true)
      awaitingReply.current = true
      if (voiceTranscript.current) {
        addMessage('user', voiceTranscript.current)
        voiceTranscript.current = ''
        setOpen(true)
      }
      return
    }

    // Received a non-status response while waiting for a reply (typed or voice)
    if (!isStatus(curr) && awaitingReply.current) {
      setIsThinking(false)
      awaitingReply.current = false
      addMessage('ai', curr)
      setOpen(true)
      return
    }

    // Bubble cleared — stop any lingering thinking state
    if (!curr) {
      setIsThinking(false)
      awaitingReply.current = false
    }
  }, [voiceBubble, voiceActive, addMessage])

  // ── Scroll to bottom ───────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  // ── Focus input on open ────────────────────────────────────────────────────

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 320)
  }, [open])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isThinking) return
    setInput('')
    addMessage('user', text)
    setIsThinking(true)
    awaitingReply.current = true
    await processVoice(text)
  }, [input, isThinking, addMessage, processVoice])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }, [handleSend])

  const handleNewChat = useCallback(() => {
    setMessages([])
    setIsThinking(false)
    voiceTranscript.current = ''
    lastBubble.current = ''
    awaitingReply.current = false
  }, [])

  const handleSuggestion = useCallback((text: string) => {
    addMessage('user', text)
    setIsThinking(true)
    awaitingReply.current = true
    void processVoice(text)
  }, [addMessage, processVoice])

  const isListening = voiceActive || LISTENING.has(voiceBubble)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating chat button — sits above the bottom nav on all screen sizes */}
      <button
        type="button"
        aria-label="Open assistant"
        onClick={() => setOpen(true)}
        className={`fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] w-14 h-14 rounded-full flex items-center justify-center border-none bg-[var(--color-accent)] text-[var(--color-text-inverse)] cursor-pointer z-[95] shadow-[0_8px_20px_-4px_var(--color-accent-translucent)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] hover:opacity-95 active:scale-95 transition-transform ${open ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <ChatBubbleIcon />
      </button>

      {/* Backdrop — full screen on mobile, subtle on desktop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[96] transition-opacity duration-250 bg-black/30 md:bg-black/10 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Panel
          Mobile:  full-width slide-up sheet from the very bottom
          Tablet+: anchored to the bottom-right corner, fixed width, above the nav bar
      */}
      <div
        role="dialog"
        aria-label="MarinLoop Assistant"
        aria-modal="true"
        className={`fixed z-[97] flex flex-col bg-[var(--color-bg-primary)] shadow-[0_-8px_40px_rgba(0,0,0,0.14)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          bottom-0 left-0 right-0 rounded-t-3xl
          md:left-auto md:right-4 md:bottom-[calc(88px+1rem+env(safe-area-inset-bottom))] md:w-[420px] md:rounded-3xl md:shadow-[0_8px_40px_rgba(0,0,0,0.18)]
          ${open ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}`}
        style={{ height: '72%', maxHeight: 600 }}
      >
        {/* Drag handle — mobile only */}
        <div className="md:hidden w-10 h-1 bg-[var(--color-border-primary)] rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[var(--color-border-primary)] shrink-0">
          <div
            aria-hidden
            className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${isThinking ? 'bg-[var(--color-amber,#f97316)] animate-pulse' : 'bg-[var(--color-green,#22c55e)]'}`}
          />
          <span className="flex-1 font-bold text-[var(--color-text-primary)]" style={{ fontSize: 'var(--text-subtitle)' }}>
            MarinLoop Assistant
          </span>
          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center gap-1 px-3 py-2 rounded-full bg-[var(--color-bg-secondary)] border-none text-[var(--color-text-secondary)] font-semibold cursor-pointer hover:bg-[var(--color-border-primary)] transition-colors"
            style={{ fontSize: 'var(--text-caption)' }}
          >
            New Chat
          </button>
          <button
            type="button"
            aria-label="Close assistant"
            onClick={() => setOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--color-bg-secondary)] border-none text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-border-primary)] transition-colors ml-1"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">
          {messages.length === 0 && !isThinking && (
            <WelcomeState onSuggestion={handleSuggestion} />
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'ai' && <AiAvatar />}
              <div
                className={`max-w-[78%] px-4 py-3 rounded-2xl leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-br-sm'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-bl-sm'
                }`}
                style={{ fontSize: 'var(--text-body)' }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-end gap-2">
              <AiAvatar />
              <div className="flex gap-1.5 px-4 py-3.5 bg-[var(--color-bg-secondary)] rounded-2xl rounded-bl-sm">
                <span className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)] animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)] animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-[var(--color-text-tertiary)] animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div
          className="flex items-center gap-2 px-3 pt-3 border-t border-[var(--color-border-primary)] shrink-0"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            aria-label={isListening ? 'Stop voice input' : 'Voice input'}
            onClick={handleVoice}
            className={`w-11 h-11 rounded-full flex items-center justify-center border-none cursor-pointer shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] transition-colors ${
              isListening
                ? 'bg-red-100 text-red-500 animate-pulse'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-primary)]'
            }`}
          >
            <MicIcon size={20} strokeWidth={2} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything…"
            aria-label="Message"
            className="flex-1 h-11 rounded-full border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            style={{ fontSize: 'var(--text-body)' }}
          />

          <button
            type="button"
            aria-label="Send"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isThinking}
            className="w-11 h-11 rounded-full flex items-center justify-center border-none cursor-pointer shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-text-inverse)] transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
          >
            <SendIcon />
          </button>
        </div>

        {/* Voice listening overlay */}
        {isListening && (
          <div className="absolute inset-0 rounded-t-3xl md:rounded-3xl bg-[var(--color-bg-primary)]/96 backdrop-blur-sm flex flex-col items-center justify-center gap-5 z-10">
            <div className="relative w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-red-200 animate-ping" />
              <MicIcon size={36} strokeWidth={2} className="text-red-500" />
            </div>
            <p className="font-bold text-[var(--color-text-primary)]" style={{ fontSize: 'var(--text-subtitle)' }}>Listening…</p>
            {voiceBubble && !isStatus(voiceBubble) && (
              <p className="text-[var(--color-accent)] italic px-8 text-center" style={{ fontSize: 'var(--text-body)' }}>
                {voiceBubble}
              </p>
            )}
            <button
              type="button"
              onClick={handleVoice}
              className="px-6 py-2.5 rounded-full border border-[var(--color-border-primary)] bg-transparent text-[var(--color-text-secondary)] font-semibold cursor-pointer"
              style={{ fontSize: 'var(--text-body)' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function WelcomeState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <AiAvatar />
        <div
          className="max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] leading-relaxed"
          style={{ fontSize: 'var(--text-body)' }}
        >
          Hi! You can type or speak — I can help with your medications, doses, reminders, and more.
        </div>
      </div>
      <div className="ml-10 flex flex-col gap-2">
        {SUGGESTIONS.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="text-left px-4 py-3 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] cursor-pointer hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-colors"
            style={{ fontSize: 'var(--text-body)' }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function AiAvatar() {
  return (
    <div
      className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-text-inverse)] font-bold shrink-0"
      style={{ fontSize: 'var(--text-caption)' }}
      aria-hidden
    >
      AI
    </div>
  )
}

function ChatBubbleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

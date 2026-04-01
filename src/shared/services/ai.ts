import { supabase } from '@/shared/lib/supabase'
import { env } from '@/shared/lib/env'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  id: string
  choices: Array<{ message: { role: string; content: string }; finish_reason: string }>
}

export const AIService = {
  async chat(messages: ChatMessage[]): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Must be logged in to use AI')
    }

    const { data, error } = await supabase.functions.invoke('openai-chat', {
      body: { messages },
    })

    if (error) {
      if (error.name === 'FunctionsHttpError') {
        const errObj = error as Record<string, unknown>
        if (typeof errObj.context === 'object' && errObj.context !== null) {
          const ctx = errObj.context as Record<string, unknown>
          if (typeof ctx.json === 'function') {
            try {
              const body = await ctx.json() as { error?: string } | null
              if (body && body.error) {
                throw new Error(body.error)
              }
            } catch {
              // ignore
            }
          }
        }
      }
      throw error
    }
    const resp = data as ChatResponse & { error?: string }
    if (resp?.error) throw new Error(resp.error)
    if (!resp?.choices?.[0]?.message?.content) {
      throw new Error('No response from AI')
    }

    return resp.choices[0].message.content
  },

  async chatStream(messages: ChatMessage[], onToken: (token: string) => void): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Must be logged in to use AI')
    }

    const res = await fetch(`${env.supabaseUrl}/functions/v1/openai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: env.supabaseAnonKey ?? '',
      },
      body: JSON.stringify({ messages, stream: true }),
    })

    if (!res.ok) {
      let errMsg = 'Request failed'
      try {
        const body = await res.json() as { error?: string }
        if (body?.error) errMsg = body.error
      } catch { /* ignore */ }
      throw new Error(errMsg)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response stream')

    const decoder = new TextDecoder()
    let full = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') break
        try {
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
          const token = parsed.choices?.[0]?.delta?.content
          if (token) {
            full += token
            onToken(token)
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    return full
  },

  isConfigured(): boolean {
    return !!env.supabaseUrl
  },
}

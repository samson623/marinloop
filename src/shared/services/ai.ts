import { supabase } from '@/shared/lib/supabase'
import { env, isDemoApp } from '@/shared/lib/env'

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
    if (isDemoApp) {
      return '[Demo mode] Add your OpenAI API key and switch to prod mode for AI features.'
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Must be logged in to use AI')
    }

    const { data, error } = await supabase.functions.invoke('openai-chat', {
      body: { messages },
    })

    if (error) throw error
    const resp = data as ChatResponse & { error?: string }
    if (resp?.error) throw new Error(resp.error)
    if (!resp?.choices?.[0]?.message?.content) {
      throw new Error('No response from AI')
    }

    return resp.choices[0].message.content
  },

  isConfigured(): boolean {
    return !isDemoApp && !!env.supabaseUrl
  },
}

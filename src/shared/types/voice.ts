/**
 * Voice UI and Web Speech API types. Used by useVoiceIntent and App voice UI.
 */

export type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

export type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>
}

export type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

export type VoiceConfirmation = {
  message: string
  onConfirm: () => void
}

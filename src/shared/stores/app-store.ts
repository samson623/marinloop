import { create } from 'zustand'

// ===== FORMATTERS (exported for views) =====
export const fT = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
export const fD = (s: string) => {
    const d = new Date(s + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
export const fDF = (s: string) => {
    const d = new Date(s + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// ===== TYPES =====
export interface SchedItem {
    id: string; type: 'med' | 'food' | 'appt'; medicationId?: string; name: string; dose?: string
    time: string; timeMinutes: number; instructions: string; warnings?: string; status: string; actualTime?: string | null
    isNext?: boolean; ws?: string; wm?: number; loc?: string
}
export type AddNotePayload = { content: string; medication_id?: string | null; appointment_id?: string | null }
export type Tab = 'timeline' | 'meds' | 'appts' | 'summary' | 'care' | 'profile'
export type ToastType = 'ts' | 'tw' | 'te'
export interface Toast {
    id: string; msg: string; cls: ToastType
}

export interface MedDraft {
    name?: string
    dose?: string
    freq?: number
    time?: string
    supply?: number
    instructions?: string
    warnings?: string
}

export interface ApptDraft {
    title?: string
    date?: string
    time?: string
    loc?: string
    notes?: string
}

export interface AddMedModalOptions {
    openScanner?: boolean
    openPhoto?: boolean
}

export interface AssistantState {
    pendingIntent: string | null
    missing: string[]
    prompt: string | null
}

interface AppState {
    toasts: Toast[]
    voice: boolean
    showAddMedModal: boolean
    showAddApptModal: boolean
    showQuickCaptureModal: boolean
    showRemindersPanel: boolean
    autoEditReminderId: string | null
    draftMed: MedDraft | null
    draftAppt: ApptDraft | null
    addMedModalOptions: AddMedModalOptions | null
    assistantState: AssistantState
    // actions
    openRemindersPanel: (autoEditReminderId?: string) => void
    closeRemindersPanel: () => void
    toast: (msg: string, cls?: ToastType) => void
    removeToast: (id: string) => void
    setVoice: (v: boolean) => void
    openAddMedModal: (draft?: MedDraft | null, options?: AddMedModalOptions | null) => void
    closeAddMedModal: () => void
    openAddApptModal: (draft?: ApptDraft | null) => void
    closeAddApptModal: () => void
    openQuickCaptureModal: () => void
    closeQuickCaptureModal: () => void
    setDraftMed: (draft: MedDraft | null) => void
    clearDraftMed: () => void
    setDraftAppt: (draft: ApptDraft | null) => void
    clearDraftAppt: () => void
    setAssistantPendingIntent: (input: { intent: string; missing?: string[]; prompt?: string | null }) => void
    clearAssistantState: () => void
}

const uid = () => '_' + Math.random().toString(36).substr(2, 9)

export const useAppStore = create<AppState>((set, get) => ({
    showAddMedModal: false,
    showAddApptModal: false,
    showQuickCaptureModal: false,
    showRemindersPanel: false,
    autoEditReminderId: null,
    draftMed: null,
    draftAppt: null,
    addMedModalOptions: null,
    assistantState: {
        pendingIntent: null,
        missing: [],
        prompt: null,
    },
    voice: true,
    toasts: [],

    openRemindersPanel: (autoEditReminderId?: string) => set({ showRemindersPanel: true, autoEditReminderId: autoEditReminderId ?? null }),
    closeRemindersPanel: () => set({ showRemindersPanel: false, autoEditReminderId: null }),
    setVoice: (v) => set({ voice: v }),
    openAddMedModal: (draft = null, options = null) => set({ showAddMedModal: true, draftMed: draft, addMedModalOptions: options }),
    closeAddMedModal: () => set({ showAddMedModal: false, draftMed: null, addMedModalOptions: null }),
    openAddApptModal: (draft = null) => set({ showAddApptModal: true, draftAppt: draft }),
    closeAddApptModal: () => set({ showAddApptModal: false, draftAppt: null }),
    openQuickCaptureModal: () => set({ showQuickCaptureModal: true }),
    closeQuickCaptureModal: () => set({ showQuickCaptureModal: false }),
    setDraftMed: (draft) => set({ draftMed: draft }),
    clearDraftMed: () => set({ draftMed: null }),
    setDraftAppt: (draft) => set({ draftAppt: draft }),
    clearDraftAppt: () => set({ draftAppt: null }),
    setAssistantPendingIntent: (input) => set({
        assistantState: {
            pendingIntent: input.intent,
            missing: input.missing ?? [],
            prompt: input.prompt ?? null,
        },
    }),
    clearAssistantState: () => set({
        assistantState: {
            pendingIntent: null,
            missing: [],
            prompt: null,
        },
    }),

    toast: (msg, cls = 'ts') => {
        const t: Toast = { id: uid(), msg, cls }
        set(s => ({ toasts: [...s.toasts, t] }))
        setTimeout(() => get().removeToast(t.id), 3500)
    },

    removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

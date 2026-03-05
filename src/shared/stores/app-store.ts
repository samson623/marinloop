import { create } from 'zustand'
import { todayLocal } from '@/shared/lib/dates'

// ===== HELPERS =====
const tM = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
}
const mT = (n: number) =>
    `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const nM = () => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
}
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
const uid = () => '_' + Math.random().toString(36).substr(2, 9)

// ===== TYPES =====
export interface Med {
    id: string; name: string; dose: string; freq: number; times: string[]
    instructions: string; warnings: string; foodWaitMinutes: number; supply: number; total: number; dosesPerDay: number
}
export interface Appt {
    id: string; title: string; date: string; time: string; loc: string; notes: string[]
}
export interface SchedItem {
    id: string; type: 'med' | 'food' | 'appt'; medicationId?: string; name: string; dose?: string
    time: string; timeMinutes: number; instructions: string; warnings?: string; status: string; actualTime?: string | null
    isNext?: boolean; ws?: string; wm?: number; loc?: string
}
export interface NoteEntry {
    id: string; text: string; time: string; medicationId: string
}
export type AddNotePayload = { content: string; medication_id?: string | null; appointment_id?: string | null }
export type Tab = 'timeline' | 'meds' | 'appts' | 'summary'
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
    loggedIn: boolean
    meds: Med[]
    appts: Appt[]
    sched: SchedItem[]
    log: Record<string, { status: string; actualTime: string | null }>
    notes: NoteEntry[]
    adherence: Record<string, { t: number; d: number }>
    voice: boolean
    toasts: Toast[]
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
    login: () => void
    logout: () => void
    openRemindersPanel: (autoEditReminderId?: string) => void
    closeRemindersPanel: () => void
    buildSched: () => void
    markDone: (id: string) => void
    markMissed: (id: string) => void
    addNote: (payload: AddNotePayload | { mid: string; text: string }) => void
    addMed: (m: Omit<Med, 'id'>) => void
    addAppt: (a: Omit<Appt, 'id'>) => void
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

export const useAppStore = create<AppState>((set, get) => ({
    loggedIn: false,
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
    log: {},
    notes: [],
    adherence: {},
    meds: [],
    appts: [],
    sched: [],

    login: () => set({ loggedIn: true }),
    logout: () => set({
        loggedIn: false,
        showAddMedModal: false,
        showAddApptModal: false,
        showQuickCaptureModal: false,
        showRemindersPanel: false,
        autoEditReminderId: null,
        draftMed: null,
        draftAppt: null,
        addMedModalOptions: null,
        assistantState: { pendingIntent: null, missing: [], prompt: null },
    }),
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

    buildSched: () => {
        const { meds, appts, log } = get()
        const items: SchedItem[] = []
        const td = todayLocal()
        meds.forEach(m => {
            m.times.forEach((t, i) => {
                const k = `${m.id}_${t}_${td}`
                const l = log[k]
                items.push({
                    id: k, type: 'med', medicationId: m.id, name: m.name, dose: m.dose, time: t, timeMinutes: tM(t),
                    instructions: m.instructions, warnings: m.warnings, status: l ? l.status : 'pending', actualTime: l ? l.actualTime : null,
                })
                if (m.foodWaitMinutes > 0 && i === 0) {
                    const e = tM(t) + m.foodWaitMinutes
                    items.push({
                        id: `f_${m.id}`, type: 'food', medicationId: m.id,
                        name: `Safe to eat (after ${m.name})`, time: mT(e), timeMinutes: e,
                        ws: t, wm: m.foodWaitMinutes, instructions: `Wait ${m.foodWaitMinutes} min after ${m.name}`, status: 'info',
                    })
                }
            })
        })
        appts.forEach(a => {
            if (a.date === td) {
                items.push({
                    id: `ap_${a.id}`, type: 'appt', name: a.title, time: a.time, timeMinutes: tM(a.time),
                    loc: a.loc, instructions: a.loc, status: 'appt',
                })
            }
        })
        items.sort((a, b) => a.timeMinutes - b.timeMinutes)
        const now = nM()
        let found = false
        items.forEach(it => {
            if (!found && it.type === 'med' && it.status === 'pending' && it.timeMinutes >= now - 60) {
                it.isNext = true; found = true
            }
        })
        set({ sched: items })
    },

    markDone: (id) => {
        const { log, meds, sched } = get()
        const it = sched.find(i => i.id === id)
        if (!it) return
        const now = nM()
        const late = now > it.timeMinutes + 15
        const newLog = { ...log, [id]: { status: late ? 'late' : 'done', actualTime: mT(now) } }
        const newMeds = meds.map(m => m.id === it.medicationId && m.supply > 0 ? { ...m, supply: m.supply - 1 } : m)
        set({ log: newLog, meds: newMeds })
        get().buildSched()
        get().toast(`${it.name} — ${late ? 'Taken late' : 'Done'}`, 'ts')
    },

    markMissed: (id) => {
        const { log, sched } = get()
        const it = sched.find(i => i.id === id)
        if (!it) return
        set({ log: { ...log, [id]: { status: 'missed', actualTime: null } } })
        get().buildSched()
        get().toast(`${it.name} marked missed`, 'te')
    },

    addNote: (payload) => {
        const { content, medication_id } = 'content' in payload
            ? { content: payload.content, medication_id: payload.medication_id ?? null }
            : { content: payload.text, medication_id: payload.mid }
        const medicationId = medication_id ?? ''
        const n = new Date()
        const note: NoteEntry = {
            id: uid(), text: content, medicationId,
            time: `${todayLocal()} ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`,
        }
        set(s => ({ notes: [note, ...s.notes] }))
        get().toast('Note saved', 'ts')
    },

    addMed: (m) => {
        const med: Med = { ...m, id: uid() }
        set(s => ({ meds: [...s.meds, med] }))
        get().buildSched()
        get().toast(`${med.name} added`, 'ts')
    },

    addAppt: (a) => {
        const appt: Appt = { ...a, id: uid() }
        set(s => ({ appts: [...s.appts, appt] }))
        get().buildSched()
        get().toast(`${appt.title} added`, 'ts')
    },

    toast: (msg, cls = 'ts') => {
        const t: Toast = { id: uid(), msg, cls }
        set(s => ({ toasts: [...s.toasts, t] }))
        setTimeout(() => get().removeToast(t.id), 3500)
    },

    removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

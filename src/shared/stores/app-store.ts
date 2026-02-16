import { create } from 'zustand'

// ===== HELPERS =====
const today = () => new Date().toISOString().split('T')[0]
const dOff = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().split('T')[0]
}
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
    inst: string; warn: string; fw: number; sup: number; tot: number; dpd: number
}
export interface Appt {
    id: string; title: string; date: string; time: string; loc: string; notes: string[]
}
export interface SchedItem {
    id: string; tp: 'med' | 'food' | 'appt'; mid?: string; name: string; dose?: string
    time: string; tm: number; inst: string; warn?: string; st: string; at?: string | null
    nx?: boolean; ws?: string; wm?: number; loc?: string
}
export interface NoteEntry {
    id: string; text: string; time: string; mid: string
}
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
    sup?: number
    inst?: string
    warn?: string
}

export interface ApptDraft {
    title?: string
    date?: string
    time?: string
    loc?: string
    notes?: string
}

export interface AssistantState {
    pendingIntent: string | null
    missing: string[]
    prompt: string | null
}

interface AppState {
    loggedIn: boolean
    tab: Tab
    meds: Med[]
    appts: Appt[]
    sched: SchedItem[]
    log: Record<string, { st: string; at: string | null }>
    notes: NoteEntry[]
    adh: Record<string, { t: number; d: number }>
    voice: boolean
    toasts: Toast[]
    showProfile: boolean
    showAddMedModal: boolean
    showAddApptModal: boolean
    draftMed: MedDraft | null
    draftAppt: ApptDraft | null
    assistantState: AssistantState
    // actions
    login: () => void
    logout: () => void
    setTab: (t: Tab) => void
    setShowProfile: (v: boolean) => void
    buildSched: () => void
    markDone: (id: string) => void
    markMissed: (id: string) => void
    addNote: (mid: string, text: string) => void
    addMed: (m: Omit<Med, 'id'>) => void
    addAppt: (a: Omit<Appt, 'id'>) => void
    toast: (msg: string, cls?: ToastType) => void
    removeToast: (id: string) => void
    setVoice: (v: boolean) => void
    openAddMedModal: (draft?: MedDraft | null) => void
    closeAddMedModal: () => void
    openAddApptModal: (draft?: ApptDraft | null) => void
    closeAddApptModal: () => void
    setDraftMed: (draft: MedDraft | null) => void
    clearDraftMed: () => void
    setDraftAppt: (draft: ApptDraft | null) => void
    clearDraftAppt: () => void
    setAssistantPendingIntent: (input: { intent: string; missing?: string[]; prompt?: string | null }) => void
    clearAssistantState: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
    loggedIn: false,
    tab: 'timeline',
    showProfile: false,
    showAddMedModal: false,
    showAddApptModal: false,
    draftMed: null,
    draftAppt: null,
    assistantState: {
        pendingIntent: null,
        missing: [],
        prompt: null,
    },
    voice: true,
    toasts: [],
    log: {},
    notes: [
        { id: 'n1', text: 'Mild dizziness after morning dose', time: dOff(-1) + ' 08:45', mid: 'm1' },
        { id: 'n2', text: 'Ask Dr. Chen about switching to morning', time: dOff(-1) + ' 14:20', mid: 'm3' },
        { id: 'n3', text: 'Missed morning — took at 10am', time: dOff(-2) + ' 10:05', mid: 'm2' },
    ],
    adh: {
        [dOff(-6)]: { t: 7, d: 7 }, [dOff(-5)]: { t: 7, d: 6 }, [dOff(-4)]: { t: 7, d: 5 },
        [dOff(-3)]: { t: 7, d: 7 }, [dOff(-2)]: { t: 7, d: 6 }, [dOff(-1)]: { t: 7, d: 7 },
    },
    meds: [
        { id: 'm1', name: 'Levothyroxine', dose: '50mcg', freq: 1, times: ['08:00'], inst: 'Take on empty stomach with water', warn: 'Do not eat for 45 min after', fw: 45, sup: 22, tot: 30, dpd: 1 },
        { id: 'm2', name: 'Amoxicillin', dose: '500mg', freq: 3, times: ['08:00', '13:00', '20:00'], inst: 'Take with or without food', warn: 'Complete full course', fw: 0, sup: 18, tot: 30, dpd: 3 },
        { id: 'm3', name: 'Lisinopril', dose: '10mg', freq: 1, times: ['21:00'], inst: 'Take at bedtime', warn: 'May cause dizziness. Avoid alcohol.', fw: 0, sup: 8, tot: 30, dpd: 1 },
        { id: 'm4', name: 'Metformin', dose: '850mg', freq: 2, times: ['08:30', '19:00'], inst: 'Take with meals', warn: 'Take with food to reduce nausea.', fw: 0, sup: 45, tot: 60, dpd: 2 },
    ],
    appts: [
        { id: 'a1', title: 'Dr. Chen — Cardiology', date: today(), time: '15:30', loc: 'City Medical Center, Suite 420', notes: ['Review blood pressure trends', 'Discuss Lisinopril dosage', 'Bring medication list'] },
        { id: 'a2', title: 'Lab Work — Blood Panel', date: dOff(3), time: '09:00', loc: 'Quest Diagnostics, 2nd Floor', notes: ['Fasting required', 'Bring insurance card'] },
        { id: 'a3', title: 'Dr. Patel — Endocrinology', date: dOff(10), time: '11:00', loc: 'University Hospital, Bldg C', notes: ['Thyroid follow-up', 'Bring recent lab results'] },
    ],
    sched: [],

    login: () => set({ loggedIn: true }),
    logout: () => set({
        loggedIn: false,
        tab: 'timeline',
        showProfile: false,
        showAddMedModal: false,
        showAddApptModal: false,
        draftMed: null,
        draftAppt: null,
        assistantState: { pendingIntent: null, missing: [], prompt: null },
    }),
    setTab: (t) => set({ tab: t, showProfile: false }),
    setShowProfile: (v) => set({ showProfile: v }),
    setVoice: (v) => set({ voice: v }),
    openAddMedModal: (draft = null) => set({ showAddMedModal: true, draftMed: draft }),
    closeAddMedModal: () => set({ showAddMedModal: false, draftMed: null }),
    openAddApptModal: (draft = null) => set({ showAddApptModal: true, draftAppt: draft }),
    closeAddApptModal: () => set({ showAddApptModal: false, draftAppt: null }),
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
        const td = today()
        meds.forEach(m => {
            m.times.forEach((t, i) => {
                const k = `${m.id}_${t}_${td}`
                const l = log[k]
                items.push({
                    id: k, tp: 'med', mid: m.id, name: m.name, dose: m.dose, time: t, tm: tM(t),
                    inst: m.inst, warn: m.warn, st: l ? l.st : 'pending', at: l ? l.at : null,
                })
                if (m.fw > 0 && i === 0) {
                    const e = tM(t) + m.fw
                    items.push({
                        id: `f_${m.id}`, tp: 'food', mid: m.id,
                        name: `Safe to eat (after ${m.name})`, time: mT(e), tm: e,
                        ws: t, wm: m.fw, inst: `Wait ${m.fw} min after ${m.name}`, st: 'info',
                    })
                }
            })
        })
        appts.forEach(a => {
            if (a.date === td) {
                items.push({
                    id: `ap_${a.id}`, tp: 'appt', name: a.title, time: a.time, tm: tM(a.time),
                    loc: a.loc, inst: a.loc, st: 'appt',
                })
            }
        })
        items.sort((a, b) => a.tm - b.tm)
        const now = nM()
        let found = false
        items.forEach(it => {
            if (!found && it.tp === 'med' && it.st === 'pending' && it.tm >= now - 60) {
                it.nx = true; found = true
            }
        })
        set({ sched: items })
    },

    markDone: (id) => {
        const { log, meds, sched } = get()
        const it = sched.find(i => i.id === id)
        if (!it) return
        const now = nM()
        const late = now > it.tm + 15
        const newLog = { ...log, [id]: { st: late ? 'late' : 'done', at: mT(now) } }
        const newMeds = meds.map(m => m.id === it.mid && m.sup > 0 ? { ...m, sup: m.sup - 1 } : m)
        set({ log: newLog, meds: newMeds })
        get().buildSched()
        get().toast(`${it.name} — ${late ? 'Taken late' : 'Done'}`, 'ts')
    },

    markMissed: (id) => {
        const { log, sched } = get()
        const it = sched.find(i => i.id === id)
        if (!it) return
        set({ log: { ...log, [id]: { st: 'missed', at: null } } })
        get().buildSched()
        get().toast(`${it.name} marked missed`, 'te')
    },

    addNote: (mid, text) => {
        const n = new Date()
        const note: NoteEntry = {
            id: uid(), text, mid,
            time: `${today()} ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`,
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

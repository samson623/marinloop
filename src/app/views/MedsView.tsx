import { useEffect, useState } from 'react'
import { useAppStore, fT } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { useRefills } from '@/shared/hooks/useRefillsList'
import { BarcodeScanner } from '@/shared/components/BarcodeScanner'
import { Modal } from '@/shared/components/Modal'
import { lookupByBarcode } from '@/shared/services/openfda'
import { Button, Input } from '@/shared/components/ui'

type AddMedModalProps = {
  onClose: () => void
  isDemo: boolean
  initialDraft: {
    name?: string
    dose?: string
    freq?: number
    time?: string
    sup?: number
    inst?: string
    warn?: string
  } | null
  createBundle: (input: {
    medication: { name: string; dosage: string; freq: number; instructions: string; warnings: string; color: string; icon: string }
    schedules: Array<{ time: string; days: number[]; food_context_minutes: number; active: boolean }>
    refill: { current_quantity: number; total_quantity: number; refill_date: string | null; pharmacy: string | null }
  }) => void
}

export function MedsView() {
  const {
    meds: demoMeds,
    toast,
    showAddMedModal,
    draftMed,
    openAddMedModal,
    closeAddMedModal,
  } = useAppStore()
  const { isDemo } = useAuthStore()
  const { meds: realMeds, addMedBundle } = useMedications()
  const { scheds } = useSchedules()
  const { refills } = useRefills()

  const displayMeds = isDemo
    ? demoMeds
    : realMeds.map((m) => {
      const myScheds = scheds.filter((s) => s.medication_id === m.id)
      const times = myScheds.map((s) => s.time.slice(0, 5))
      const refill = refills.find((r) => r.medication_id === m.id)
      const sup = refill?.current_quantity ?? 0
      const tot = refill?.total_quantity ?? 30
      const dpd = m.freq || 1

      return {
        id: m.id,
        name: m.name,
        dose: m.dosage || '',
        freq: m.freq,
        times,
        inst: m.instructions || '',
        warn: m.warnings || '',
        fw: 0,
        sup,
        tot,
        dpd,
      }
    })

  return (
    <div className="animate-view-in">
      <h2 className="text-xl font-extrabold tracking-[-0.02em] mb-4 pb-2.5 border-b-2 border-[var(--color-text-primary)] text-[var(--color-text-primary)]">
        Medications
      </h2>

      <div className="stagger-children">
        {displayMeds.length === 0 && !isDemo && (
          <div className="py-5 text-center text-[var(--color-text-secondary)] border border-dashed border-[var(--color-border-secondary)] rounded-xl">
            No medications found. Add one below.
          </div>
        )}

        {displayMeds.map((m, i) => {
          const p = m.tot > 0 ? (m.sup / m.tot) * 100 : 0
          const days = m.dpd > 0 ? Math.floor(m.sup / m.dpd) : 0
          const sc = p < 20 ? 'var(--color-red)' : p < 40 ? 'var(--color-amber)' : 'var(--color-green)'

          return (
            <button
              key={m.id}
              type="button"
              className="animate-slide-r card-interactive w-full text-left bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-[14px] p-3.5 mb-2 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              style={{ animationDelay: `${i * 0.04}s` }}
              onClick={() => toast(`${m.name} - ${m.inst}`, 'ts')}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[15px] font-bold text-[var(--color-text-primary)]">{m.name}</span>
                <span className="text-[11px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)] py-0.5 px-2 rounded-md [font-family:var(--font-mono)]">{m.dose}</span>
              </div>
              <div className="flex flex-wrap gap-3.5 text-xs text-[var(--color-text-secondary)]">
                <span className="flex items-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {m.times.length > 0 ? m.times.map((t) => fT(t)).join(', ') : 'No time set'}
                </span>
                <span className="flex items-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
                  {m.freq}x daily
                </span>
              </div>
              <div className="mt-2 h-1 bg-[var(--color-ring-track)] rounded overflow-hidden">
                <div
                  className="h-full rounded transition-[width] duration-300"
                  style={{ width: `${p}%`, background: sc }}
                />
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1 flex justify-between [font-family:var(--font-mono)]">
                <span>{m.sup} pills left</span>
                <span>{days} days{days <= 5 ? ' - Refill soon' : ''}</span>
              </div>
            </button>
          )
        })}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="md"
        onClick={() => openAddMedModal(null)}
        className="mt-2.5 border-2 border-dashed border-[var(--color-border-primary)] text-[var(--color-text-tertiary)] flex items-center justify-center gap-1.5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Add Medication
      </Button>

      {showAddMedModal && (
        <AddMedModal
          onClose={closeAddMedModal}
          createBundle={addMedBundle}
          isDemo={isDemo}
          initialDraft={draftMed}
        />
      )}
    </div>
  )
}

function AddMedModal({ onClose, createBundle, isDemo, initialDraft }: AddMedModalProps) {
  const { addMed: addMedDemo, toast } = useAppStore()
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [freq, setFreq] = useState('1')
  const [time, setTime] = useState('08:00')
  const [sup, setSup] = useState('30')
  const [inst, setInst] = useState('')
  const [warn, setWarn] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [isLooking, setIsLooking] = useState(false)

  useEffect(() => {
    if (!initialDraft) return
    if (initialDraft.name) setName(initialDraft.name)
    if (initialDraft.dose) setDose(initialDraft.dose)
    if (typeof initialDraft.freq === 'number') setFreq(String(initialDraft.freq))
    if (initialDraft.time) setTime(initialDraft.time)
    if (typeof initialDraft.sup === 'number') setSup(String(initialDraft.sup))
    if (initialDraft.inst) setInst(initialDraft.inst)
    if (initialDraft.warn) setWarn(initialDraft.warn)
  }, [initialDraft])

  const handleScan = async (code: string) => {
    setShowScanner(false)
    setIsLooking(true)
    toast('Barcode detected! Looking up medication...', 'ts')

    try {
      const result = await lookupByBarcode(code)
      if (result) {
        if (result.name) setName(result.name)
        if (result.dosage) setDose(result.dosage)
        if (result.instructions) setInst(result.instructions)
        if (result.warnings) setWarn(result.warnings)
        toast('Medication info loaded ✓', 'ts')
      } else {
        toast('Medication not found in FDA database. Enter details manually.', 'tw')
      }
    } catch {
      toast('Lookup failed. Please enter details manually.', 'te')
    } finally {
      setIsLooking(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const f = Number.parseInt(freq, 10) || 1

    if (isDemo) {
      addMedDemo({ name, dose, freq: f, times: [time], inst, warn, fw: 0, sup: Number.parseInt(sup, 10) || 30, tot: Number.parseInt(sup, 10) || 30, dpd: f })
    } else {
      createBundle({
        medication: {
          name,
          dosage: dose,
          freq: f,
          instructions: inst,
          warnings: warn,
          color: 'sky',
          icon: 'pill',
        },
        schedules: [
          {
            time,
            days: [0, 1, 2, 3, 4, 5, 6],
            food_context_minutes: 0,
            active: true,
          },
        ],
        refill: {
          current_quantity: Number.parseInt(sup, 10) || 30,
          total_quantity: Number.parseInt(sup, 10) || 30,
          refill_date: null,
          pharmacy: null,
        },
      })
    }

    onClose()
  }

  return (
    <>
      <Modal open onOpenChange={(o) => !o && onClose()} title="Add Medication" variant="bottom">
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          disabled={isLooking}
          className="tap-spring w-full py-3.5 mb-4 bg-[var(--color-accent-bg)] border-[1.5px] border-[var(--color-green-border)] rounded-xl text-sm font-bold text-[var(--color-accent)] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          {isLooking ? (
            <>
              <div className="w-[18px] h-[18px] border-2 border-[var(--color-green-border)] border-t-2 border-t-[var(--color-accent)] rounded-full spin-loading" />
              Looking up medication...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="8" x2="13" y2="8" /><line x1="7" y1="16" x2="15" y2="16" />
              </svg>
              Scan Barcode
            </>
          )}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
          <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.08em]">or enter manually</span>
          <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
        </div>

        <form onSubmit={handleSubmit}>
          <FormField label="Name" id="med-name">
            <Input id="med-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amoxicillin" required />
          </FormField>
          <div className="flex gap-2.5">
            <FormField label="Dosage" id="med-dosage">
              <Input id="med-dosage" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 500mg" />
            </FormField>
            <FormField label="Frequency" id="med-freq">
              <select className="fi" id="med-freq" value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="1">Once daily</option>
                <option value="2">Twice daily</option>
                <option value="3">Three times</option>
              </select>
            </FormField>
          </div>
          <div className="flex gap-2.5">
            <FormField label="Time" id="med-time">
              <Input id="med-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </FormField>
            <FormField label="Pills in Bottle" id="med-sup">
              <Input id="med-sup" type="number" value={sup} onChange={(e) => setSup(e.target.value)} min={0} />
            </FormField>
          </div>
          <FormField label="Instructions" id="med-inst">
            <Input id="med-inst" value={inst} onChange={(e) => setInst(e.target.value)} placeholder="e.g. Take with food" />
          </FormField>
          <FormField label="Warnings" id="med-warn">
            <Input id="med-warn" value={warn} onChange={(e) => setWarn(e.target.value)} placeholder="e.g. May cause drowsiness" />
          </FormField>
          <Button type="submit" variant="primary" size="md" className="mt-1.5">
            Add Medication
          </Button>
        </form>
      </Modal>

      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  )
}

function FormField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex-1">
      <label htmlFor={id} className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-[0.08em]">
        {label}
      </label>
      {children}
    </div>
  )
}

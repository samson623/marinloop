import { useEffect, useState } from 'react'
import { useAppStore, fT } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { useRefills } from '@/shared/hooks/useRefillsList'
import { BarcodeScanner } from '@/shared/components/BarcodeScanner'
import { lookupByBarcode } from '@/shared/services/openfda'

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
      <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--color-text-primary)' }}>
        Medications
      </h2>

      <div className="stagger-children">
        {displayMeds.length === 0 && !isDemo && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border-secondary)', borderRadius: 12 }}>
            No medications found. Add one below.
          </div>
        )}

        {displayMeds.map((m, i) => {
          const p = m.tot > 0 ? (m.sup / m.tot) * 100 : 0
          const days = m.dpd > 0 ? Math.floor(m.sup / m.dpd) : 0
          const sc = p < 20 ? 'var(--color-red)' : p < 40 ? 'var(--color-amber)' : 'var(--color-green)'

          return (
            <div
              key={m.id}
              className="animate-slide-r card-interactive"
              onClick={() => toast(`${m.name} - ${m.inst}`, 'ts')}
              style={{
                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-secondary)',
                borderRadius: 14, padding: 14, marginBottom: 8, cursor: 'pointer', animationDelay: `${i * 0.04}s`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-tertiary)', padding: '2px 8px', borderRadius: 6 }}>{m.dose}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {m.times.length > 0 ? m.times.map((t) => fT(t)).join(', ') : 'No time set'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
                  {m.freq}x daily
                </span>
              </div>
              <div style={{ marginTop: 8, height: 4, background: 'var(--color-ring-track)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${p}%`, background: sc, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>{m.sup} pills left</span>
                <span>{days} days{days <= 5 ? ' - Refill soon' : ''}</span>
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={() => openAddMedModal(null)} style={{
        width: '100%', padding: 14, background: 'transparent', border: '2px dashed var(--color-border-primary)',
        borderRadius: 14, fontSize: 14, fontWeight: 700, color: 'var(--color-text-tertiary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Add Medication
      </button>

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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--color-overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '88vh', background: 'var(--color-bg-primary)', borderRadius: '16px 16px 0 0', overflowY: 'auto' }}>
          <div style={{ width: 36, height: 4, background: 'var(--color-text-tertiary)', opacity: 0.3, margin: '10px auto', borderRadius: 4 }} />
          <div style={{ padding: '4px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-primary)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700 }}>Add Medication</h3>
            <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-tertiary)', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', borderRadius: '50%' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div style={{ padding: 20 }}>
            {/* Scan Barcode Button */}
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              disabled={isLooking}
              className="tap-spring"
              style={{
                width: '100%',
                padding: 14,
                marginBottom: 18,
                background: 'var(--color-accent-bg)',
                border: '1.5px solid var(--color-green-border)',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-accent)',
                cursor: isLooking ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: isLooking ? 0.6 : 1,
                transition: 'opacity 0.2s, transform 0.15s',
              }}
            >
              {isLooking ? (
                <>
                  <div style={{
                    width: 18, height: 18,
                    border: '2px solid var(--color-green-border)',
                    borderTop: '2px solid var(--color-accent)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Looking up medication...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="7" y1="8" x2="13" y2="8" />
                    <line x1="7" y1="16" x2="15" y2="16" />
                  </svg>
                  Scan Barcode
                </>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-primary)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>or enter manually</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-primary)' }} />
            </div>

            <form onSubmit={handleSubmit}>
              <FormField label="Name"><input className="fi" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amoxicillin" required /></FormField>
              <div style={{ display: 'flex', gap: 10 }}>
                <FormField label="Dosage"><input className="fi" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 500mg" /></FormField>
                <FormField label="Frequency">
                  <select className="fi" value={freq} onChange={(e) => setFreq(e.target.value)} style={{ appearance: 'auto' }}>
                    <option value="1">Once daily</option>
                    <option value="2">Twice daily</option>
                    <option value="3">Three times</option>
                  </select>
                </FormField>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <FormField label="Time"><input className="fi" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></FormField>
                <FormField label="Pills in Bottle"><input className="fi" type="number" value={sup} onChange={(e) => setSup(e.target.value)} min="0" /></FormField>
              </div>
              <FormField label="Instructions"><input className="fi" value={inst} onChange={(e) => setInst(e.target.value)} placeholder="e.g. Take with food" /></FormField>
              <FormField label="Warnings"><input className="fi" value={warn} onChange={(e) => setWarn(e.target.value)} placeholder="e.g. May cause drowsiness" /></FormField>
              <button type="submit" style={{ width: '100%', padding: 14, background: 'var(--color-accent)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', borderRadius: 12, marginTop: 6 }}>
                Add Medication
              </button>
            </form>
          </div>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14, flex: 1 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
      {children}
    </div>
  )
}

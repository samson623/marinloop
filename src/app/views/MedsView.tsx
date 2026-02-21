import { useEffect, useState, useRef } from 'react'
import { useAppStore, fT } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { useRefills } from '@/shared/hooks/useRefillsList'
import { BarcodeScanner } from '@/shared/components/BarcodeScanner'
import { Modal } from '@/shared/components/Modal'
import { lookupByBarcode } from '@/shared/services/openfda'
import { extractFromImage } from '@/shared/services/label-extract'
import { handleMutationError } from '@/shared/lib/errors'
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
    <div className="animate-view-in w-full max-w-[480px] mx-auto">
      <h2 className="font-extrabold tracking-[-0.02em] mb-5 pb-3 border-b-2 border-[var(--color-text-primary)] text-[var(--color-text-primary)] text-xl sm:[font-size:var(--text-title)]">
        Medications
      </h2>

      <div className="stagger-children">
        {displayMeds.length === 0 && !isDemo && (
          <div className="py-8 px-5 text-center border-2 border-dashed border-[var(--color-border-secondary)] rounded-2xl sm:py-6 sm:px-4">
            <p className="text-[var(--color-text-secondary)] text-lg font-medium sm:text-base">No medications found. Add one below.</p>
            <p className="mt-2 text-[var(--color-text-tertiary)] text-sm sm:[font-size:var(--text-caption)]">Add your first medication to get started</p>
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
              className="animate-slide-r card-interactive w-full text-left bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-2xl p-4 mb-3 min-h-[72px] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              style={{ animationDelay: `${i * 0.04}s` }}
              onClick={() => toast(`${m.name} - ${m.inst}`, 'ts')}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="font-bold text-[var(--color-text-primary)] text-base sm:[font-size:var(--text-body)]">{m.name}</span>
                <span className="text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)] py-1 px-2.5 rounded-lg [font-family:var(--font-mono)] text-sm sm:[font-size:var(--text-caption)] shrink-0">{m.dose}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-[var(--color-text-secondary)] text-sm sm:[font-size:var(--text-label)]">
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {m.times.length > 0 ? m.times.map((t) => fT(t)).join(', ') : 'No time set'}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
                  {m.freq}x daily
                </span>
              </div>
              <div className="mt-3 h-1.5 bg-[var(--color-ring-track)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${p}%`, background: sc }}
                />
              </div>
              <div className="text-[var(--color-text-tertiary)] mt-1.5 flex justify-between [font-family:var(--font-mono)] text-sm sm:[font-size:var(--text-caption)]">
                <span>{m.sup} pills left</span>
                <span>{days} days{days <= 5 ? ' — Refill soon' : ''}</span>
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
        className="mt-4 py-4 text-lg font-bold border-2 border-dashed border-[var(--color-border-primary)] text-[var(--color-text-secondary)] flex items-center justify-center gap-2 min-h-[52px] sm:mt-2.5 sm:py-3.5 sm:text-base sm:font-semibold sm:min-h-0"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 sm:w-[18px] sm:h-[18px]"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
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
  const [showBarcodeInput, setShowBarcodeInput] = useState(false)
  const [barcodeInputValue, setBarcodeInputValue] = useState('')
  const [isLooking, setIsLooking] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [pendingExtract, setPendingExtract] = useState<{ name?: string; dosage?: string; freq?: number; time?: string; quantity?: number; instructions?: string; warnings?: string; confidence?: number } | null>(null)
  const scannerInputRef = useRef<HTMLInputElement>(null)
  const labelPhotoInputRef = useRef<HTMLInputElement>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const scannerRapidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canLookupCode = (value: string) => {
    const trimmed = value.trim()
    const digits = trimmed.replace(/\D/g, '')
    const hyphenatedNdc = /^\d{4,5}-\d{3,4}-\d{1,2}$/.test(trimmed.replace(/\s/g, ''))
    return digits.length >= 10 || hyphenatedNdc
  }

  useEffect(() => {
    if (showScanner) return
    if (showBarcodeInput) {
      barcodeInputRef.current?.focus()
    } else {
      scannerInputRef.current?.focus()
    }
  }, [showScanner, showBarcodeInput])

  useEffect(() => {
    return () => {
      if (scannerRapidTimeoutRef.current) {
        clearTimeout(scannerRapidTimeoutRef.current)
      }
    }
  }, [])

  const flushScannerInput = (el: HTMLInputElement | null) => {
    if (!el) return
    const raw = el.value?.trim() || ''
    if (canLookupCode(raw)) {
      el.value = ''
      void handleScan(raw)
    }
  }

  const handleScannerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const el = e.currentTarget as HTMLInputElement
      const raw = el.value?.trim() || ''
      if (canLookupCode(raw)) {
        e.preventDefault()
        el.value = ''
        void handleScan(raw)
      }
      if (scannerRapidTimeoutRef.current) {
        clearTimeout(scannerRapidTimeoutRef.current)
        scannerRapidTimeoutRef.current = null
      }
      return
    }
  }

  const handleScannerInput = (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    if (scannerRapidTimeoutRef.current) clearTimeout(scannerRapidTimeoutRef.current)
    const raw = el.value?.trim() || ''
    if (canLookupCode(raw)) {
      scannerRapidTimeoutRef.current = setTimeout(() => {
        scannerRapidTimeoutRef.current = null
        flushScannerInput(el)
      }, 150)
    }
  }

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

  const handleBarcodeLookup = async () => {
    const code = barcodeInputValue.trim()
    if (canLookupCode(code)) {
      const ok = await handleScan(code)
      if (ok) {
        setShowBarcodeInput(false)
        setBarcodeInputValue('')
      }
    }
  }

  const applyExtractToForm = (r: { name?: string; dosage?: string; freq?: number; time?: string; quantity?: number; instructions?: string; warnings?: string }) => {
    if (r.name?.trim()) setName(r.name)
    if (r.dosage?.trim()) setDose(r.dosage)
    if (typeof r.freq === 'number' && [1, 2, 3].includes(r.freq)) setFreq(String(r.freq))
    if (r.time?.trim()) setTime(r.time)
    if (typeof r.quantity === 'number') setSup(String(r.quantity))
    if (r.instructions?.trim()) setInst(r.instructions)
    if (r.warnings?.trim()) setWarn(r.warnings)
  }

  const handleLabelPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file.', 'tw')
      return
    }
    setIsLooking(true)
    toast('Reading label...', 'ts')
    try {
      const result = await extractFromImage(file)
      const conf = result.confidence ?? 0.5
      const hasUsefulData = Boolean(
        result.name?.trim() || result.dosage?.trim() || result.instructions?.trim() || result.warnings?.trim()
      )
      if (!hasUsefulData) {
        toast("Couldn't read enough from the label. Please enter manually.", 'tw')
        return
      }
      if (conf < 0.6) {
        setPendingExtract(result)
        setShowVerifyModal(true)
      } else {
        applyExtractToForm(result)
        toast('Label info loaded. Please verify before saving.', 'ts')
      }
    } catch (e) {
      handleMutationError(e, 'label-extract', "Couldn't read the label. Please enter manually.", toast)
    } finally {
      setIsLooking(false)
    }
  }

  const handleVerifyConfirm = () => {
    if (pendingExtract) {
      applyExtractToForm(pendingExtract)
      toast('Label info loaded. Please verify before saving.', 'ts')
    }
    setShowVerifyModal(false)
    setPendingExtract(null)
  }

  const handleVerifyEdit = () => {
    setShowVerifyModal(false)
    setPendingExtract(null)
    toast("Please enter details manually below.", 'tw')
  }

  const handleScan = async (code: string): Promise<boolean> => {
    const normalizedCode = code.trim()
    if (!canLookupCode(normalizedCode)) {
      toast('Barcode must include at least 10 digits.', 'tw')
      return false
    }

    setIsLooking(true)
    toast('Barcode detected! Looking up medication...', 'ts')

    try {
      const result = await lookupByBarcode(normalizedCode)
      const hasUsefulData = Boolean(
        result &&
        (result.name?.trim() || result.dosage?.trim() || result.instructions?.trim() || result.warnings?.trim())
      )
      if (hasUsefulData && result) {
        if (result.name?.trim()) setName(result.name)
        if (result.dosage?.trim()) setDose(result.dosage)
        if (result.instructions?.trim()) setInst(result.instructions)
        if (result.warnings?.trim()) setWarn(result.warnings)
        setShowScanner(false)
        toast('Medication info loaded', 'ts')
        return true
      } else {
        toast("We couldn't find that in our database. Type the medication name below.", 'tw')
        return false
      }
    } catch {
      toast('Lookup failed. Please enter details manually.', 'te')
      return false
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
      <Modal open onOpenChange={(o) => !o && onClose()} title="Add Medication" variant="center">
        {/* Hidden input for USB barcode scanners (keyboard wedge mode) */}
        <input
          ref={scannerInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Barcode scanner input"
          className="absolute opacity-0 w-0 h-0 -left-[9999px] pointer-events-none"
          tabIndex={0}
          onKeyDown={handleScannerInputKeyDown}
          onInput={handleScannerInput}
        />
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          disabled={isLooking}
          className="tap-spring w-full max-w-full py-4 px-6 mb-3 bg-[var(--color-accent-bg)] border-2 border-[var(--color-green-border)] rounded-2xl font-bold text-[var(--color-accent)] cursor-pointer flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-wait outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] min-h-[52px] [font-size:var(--text-body)]"
        >
          {isLooking ? (
            <>
              <div className="w-5 h-5 border-2 border-[var(--color-green-border)] border-t-2 border-t-[var(--color-accent)] rounded-full spin-loading shrink-0" />
              <span>Looking up medication...</span>
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
                <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="8" x2="13" y2="8" /><line x1="7" y1="16" x2="15" y2="16" />
              </svg>
              <span>Scan Barcode</span>
            </>
          )}
        </button>

        {!showBarcodeInput ? (
          <button
            type="button"
            onClick={() => setShowBarcodeInput(true)}
            disabled={isLooking}
            className="w-full py-3 px-6 mb-2 rounded-2xl font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border-primary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer disabled:opacity-60 [font-size:var(--text-body)]"
          >
            I have the barcode number
          </button>
        ) : (
          <div className="mb-5 flex gap-2">
            <Input
              ref={barcodeInputRef}
              type="text"
              inputMode="text"
              autoComplete="off"
              value={barcodeInputValue}
              onChange={(e) => setBarcodeInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleBarcodeLookup()
                }
                if (e.key === 'Escape') setShowBarcodeInput(false)
              }}
              placeholder="e.g. B580-142436-1431"
              className="flex-1 font-mono"
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => { void handleBarcodeLookup() }}
              disabled={!canLookupCode(barcodeInputValue)}
            >
              Look up
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => { setShowBarcodeInput(false); setBarcodeInputValue('') }}>
              Cancel
            </Button>
          </div>
        )}

        {!isDemo && (
          <>
            <input
              ref={labelPhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Take photo of prescription label"
              className="absolute opacity-0 w-0 h-0 -left-[9999px] pointer-events-none"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  void handleLabelPhoto(f)
                  e.target.value = ''
                }
              }}
            />
            <button
              type="button"
              onClick={() => labelPhotoInputRef.current?.click()}
              disabled={isLooking}
              aria-label="Take photo of prescription label"
              aria-busy={isLooking}
              aria-live="polite"
              className="w-full py-3 px-6 mb-5 rounded-2xl font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border-primary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-3 [font-size:var(--text-body)]"
            >
          {isLooking ? (
            <>
              <div className="w-5 h-5 border-2 border-[var(--color-border-primary)] border-t-2 border-t-[var(--color-accent)] rounded-full spin-loading shrink-0" />
              <span>Reading label...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>Take photo of label</span>
            </>
          )}
        </button>
            <p className="text-[var(--color-text-tertiary)] text-xs mb-4 -mt-2 px-1">
              Extracted info is for convenience only. Always verify against your label and follow your healthcare provider&apos;s instructions.
            </p>
          </>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
          <span className="font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.08em] [font-size:var(--text-caption)]">or enter manually</span>
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

      {showVerifyModal && pendingExtract && (
        <Modal open onOpenChange={(o) => !o && handleVerifyEdit()} title="Verify extracted details" variant="center">
          <p className="text-[var(--color-text-secondary)] mb-4 [font-size:var(--text-body)]">
            Please verify these details against your label.
          </p>
          <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 mb-4 space-y-2 text-sm" role="region" aria-label="Extracted medication summary">
            {pendingExtract.name && <p><strong>Name:</strong> {pendingExtract.name}</p>}
            {pendingExtract.dosage && <p><strong>Dosage:</strong> {pendingExtract.dosage}</p>}
            {pendingExtract.freq != null && <p><strong>Frequency:</strong> {pendingExtract.freq}x daily</p>}
            {pendingExtract.time && <p><strong>Time:</strong> {pendingExtract.time}</p>}
            {pendingExtract.quantity != null && <p><strong>Quantity:</strong> {pendingExtract.quantity}</p>}
            {pendingExtract.instructions && <p><strong>Instructions:</strong> {pendingExtract.instructions}</p>}
            {pendingExtract.warnings && <p><strong>Warnings:</strong> {pendingExtract.warnings}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="md" onClick={handleVerifyConfirm}>
              Confirm
            </Button>
            <Button variant="ghost" size="md" onClick={handleVerifyEdit}>
              Edit manually
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}

function FormField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex-1">
      <label htmlFor={id} className="block font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-[0.08em] [font-size:var(--text-label)]">
        {label}
      </label>
      {children}
    </div>
  )
}

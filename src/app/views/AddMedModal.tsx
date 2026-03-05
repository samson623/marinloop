import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '@/shared/stores/app-store'
import { BarcodeScanner } from '@/shared/components/BarcodeScanner'
import { Modal } from '@/shared/components/Modal'
import { lookupByBarcode } from '@/shared/services/openfda'
import { extractFromImages } from '@/shared/services/label-extract'
import { handleMutationError } from '@/shared/lib/errors'
import { Button, Input } from '@/shared/components/ui'
import { generateEvenlySpacedTimes } from '@/shared/lib/scheduling'

type AddMedModalProps = {
  onClose: () => void
  isSaving: boolean
  initialDraft: {
    name?: string
    dose?: string
    freq?: number
    time?: string
    supply?: number
    instructions?: string
    warnings?: string
  } | null
  openScanner?: boolean
  openPhoto?: boolean
  createBundleAsync: (input: {
    medication: { name: string; dosage: string; freq: number; instructions: string; warnings: string; color: string; icon: string }
    schedules: Array<{ time: string; days: number[]; food_context_minutes: number; active: boolean }>
    refill: { current_quantity: number; total_quantity: number; refill_date: string | null; pharmacy: string | null }
  }) => Promise<string>
}

export default function AddMedModal({ onClose, createBundleAsync, isSaving, initialDraft, openScanner: openScannerProp, openPhoto: openPhotoProp }: AddMedModalProps) {
  const { toast } = useAppStore()
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [freq, setFreq] = useState('1')
  const [times, setTimes] = useState<string[]>(['08:00'])
  const [sup, setSup] = useState('30')
  const [inst, setInst] = useState('')
  const [warn, setWarn] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [showBarcodeInput, setShowBarcodeInput] = useState(false)
  const [barcodeInputValue, setBarcodeInputValue] = useState('')
  const [isLooking, setIsLooking] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [pendingExtract, setPendingExtract] = useState<{ name?: string; dosage?: string; freq?: number; time?: string; quantity?: number; instructions?: string; warnings?: string; confidence?: number } | null>(null)
  const [labelPhotos, setLabelPhotos] = useState<File[]>([])
  const [photoThumbs, setPhotoThumbs] = useState<string[]>([])
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

  const handleFreqChange = (newFreq: string) => {
    const n = Number.parseInt(newFreq, 10) || 1
    setFreq(newFreq)
    setTimes((prev) => {
      if (prev.length === n) return prev
      if (prev.length < n) {
        return generateEvenlySpacedTimes(n, prev[0])
      }
      return prev.slice(0, n)
    })
  }

  const updateTimeAtIndex = (index: number, value: string) => {
    setTimes((prev) => prev.map((v, i) => (i === index ? value : v)))
  }

  useEffect(() => {
    if (!initialDraft) return
    if (initialDraft.name) setName(initialDraft.name)
    if (initialDraft.dose) setDose(initialDraft.dose)
    if (typeof initialDraft.freq === 'number') {
      setFreq(String(initialDraft.freq))
      if (initialDraft.time) {
        setTimes(initialDraft.freq > 1 ? generateEvenlySpacedTimes(initialDraft.freq, initialDraft.time) : [initialDraft.time])
      } else {
        setTimes(generateEvenlySpacedTimes(initialDraft.freq))
      }
    } else if (initialDraft.time) {
      setTimes([initialDraft.time])
    }
    if (typeof initialDraft.supply === 'number') setSup(String(initialDraft.supply))
    if (initialDraft.instructions) setInst(initialDraft.instructions)
    if (initialDraft.warnings) setWarn(initialDraft.warnings)
  }, [initialDraft])

  useEffect(() => {
    if (openScannerProp) setShowScanner(true)
  }, [openScannerProp])

  useEffect(() => {
    if (openPhotoProp) {
      const timer = setTimeout(() => labelPhotoInputRef.current?.click(), 150)
      return () => clearTimeout(timer)
    }
  }, [openPhotoProp])

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
    if (typeof r.freq === 'number' && [1, 2, 3].includes(r.freq)) {
      setFreq(String(r.freq))
      if (r.freq > 1) {
        setTimes(generateEvenlySpacedTimes(r.freq, r.time?.trim() || '08:00'))
      } else if (r.time?.trim()) {
        setTimes([r.time])
      }
    } else if (r.time?.trim()) {
      setTimes([r.time])
    }
    if (typeof r.quantity === 'number') setSup(String(r.quantity))
    if (r.instructions?.trim()) setInst(r.instructions)
    if (r.warnings?.trim()) setWarn(r.warnings)
  }

  const addLabelPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file.', 'tw')
      return
    }
    if (labelPhotos.length >= 5) {
      toast('Maximum 5 images allowed.', 'tw')
      return
    }
    setLabelPhotos((prev) => [...prev, file])
    const url = URL.createObjectURL(file)
    setPhotoThumbs((prev) => [...prev, url])
  }

  const removeLabelPhoto = (index: number) => {
    URL.revokeObjectURL(photoThumbs[index])
    setLabelPhotos((prev) => prev.filter((_, i) => i !== index))
    setPhotoThumbs((prev) => prev.filter((_, i) => i !== index))
  }

  const processAllPhotos = async () => {
    if (labelPhotos.length === 0) {
      toast('Add at least one photo first.', 'tw')
      return
    }
    setIsLooking(true)
    toast(labelPhotos.length > 1 ? `Reading ${labelPhotos.length} label photos...` : 'Reading label...', 'ts')
    try {
      const result = await extractFromImages(labelPhotos)
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
      // Clear photos after successful processing
      photoThumbs.forEach((url) => URL.revokeObjectURL(url))
      setLabelPhotos([])
      setPhotoThumbs([])
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const f = Number.parseInt(freq, 10) || 1

    try {
      await createBundleAsync({
        medication: {
          name,
          dosage: dose,
          freq: f,
          instructions: inst,
          warnings: warn,
          color: 'sky',
          icon: 'pill',
        },
        schedules: times.map((t) => ({
          time: t,
          days: [0, 1, 2, 3, 4, 5, 6],
          food_context_minutes: 0,
          active: true,
        })),
        refill: {
          current_quantity: Number.parseInt(sup, 10) || 30,
          total_quantity: Number.parseInt(sup, 10) || 30,
          refill_date: null,
          pharmacy: null,
        },
      })
      onClose()
    } catch {
      // Error already handled by mutation's onError callback (toast shown)
      // Don't close modal so user can retry
    }
  }

  return (
    <>
      <Modal open onOpenChange={(o) => !o && onClose()} title="Add Medication" variant="responsive">
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

        <>
            <input
              ref={labelPhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              aria-label="Take or upload photos of prescription label or pill bottle"
              className="absolute opacity-0 w-0 h-0 -left-[9999px] pointer-events-none"
              onChange={(e) => {
                const files = e.target.files
                if (files) {
                  Array.from(files).forEach((f) => addLabelPhoto(f))
                  e.target.value = ''
                }
              }}
            />

            {/* Photo thumbnails */}
            {photoThumbs.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    {labelPhotos.length} photo{labelPhotos.length !== 1 ? 's' : ''} added
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    (up to 5 — add multiple sides of the bottle)
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {photoThumbs.map((thumb, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] shrink-0">
                      <img src={thumb} alt={`Label photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeLabelPhoto(i)}
                        className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[var(--color-red)] text-white rounded-full flex items-center justify-center text-xs font-bold cursor-pointer shadow-sm"
                        aria-label={`Remove photo ${i + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {labelPhotos.length < 5 && (
                    <button
                      type="button"
                      onClick={() => labelPhotoInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-[var(--color-border-secondary)] flex items-center justify-center text-[var(--color-text-tertiary)] cursor-pointer hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                      aria-label="Add another photo"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { void processAllPhotos() }}
                  disabled={isLooking || labelPhotos.length === 0}
                  className="mt-2 w-full py-3 px-6 rounded-2xl font-bold text-white bg-[var(--color-accent)] cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2 [font-size:var(--text-body)]"
                >
                  {isLooking ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-2 border-t-white rounded-full spin-loading shrink-0" />
                      <span>Reading {labelPhotos.length > 1 ? `${labelPhotos.length} photos` : 'label'}...</span>
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                      <span>Process {labelPhotos.length > 1 ? `${labelPhotos.length} photos` : 'photo'}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {labelPhotos.length === 0 && (
              <button
                type="button"
                onClick={() => labelPhotoInputRef.current?.click()}
                disabled={isLooking}
                aria-label="Take or upload photos of prescription label or pill bottle"
                aria-busy={isLooking}
                aria-live="polite"
                className="w-full py-3 px-6 mb-3 rounded-2xl font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border-primary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-3 [font-size:var(--text-body)]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>📸 Photo label (multiple sides)</span>
              </button>
            )}
            <p className="text-[var(--color-text-tertiary)] text-xs mb-4 -mt-1 px-1">
              Photograph all sides of your pill bottle for best results. You can add up to 5 photos.
            </p>
          </>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
          <span className="font-semibold text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">Or enter manually</span>
          <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-1">
          {/* Name */}
          <div>
            <label htmlFor="med-name" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Name</label>
            <Input id="med-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amoxicillin" required />
          </div>

          {/* Dosage | Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="med-dosage" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Dosage</label>
              <Input id="med-dosage" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 500mg" />
            </div>
            <div>
              <label htmlFor="med-freq" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Frequency</label>
              <select className="fi w-full" id="med-freq" value={freq} onChange={(e) => handleFreqChange(e.target.value)}>
                <option value="1">Once daily</option>
                <option value="2">Twice daily</option>
                <option value="3">Three times</option>
              </select>
            </div>
          </div>

          {/* Schedule & Supply */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">Schedule & Supply</span>
              <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              {times.map((t, i) => (
                <div key={i}>
                  <label htmlFor={`med-time-${i}`} className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">
                    {times.length > 1 ? `Time ${i + 1}` : 'Time'}
                  </label>
                  <Input id={`med-time-${i}`} type="time" value={t} onChange={(e) => updateTimeAtIndex(i, e.target.value)} />
                </div>
              ))}
              <div>
                <label htmlFor="med-sup" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Pills in Bottle</label>
                <Input id="med-sup" type="number" value={sup} onChange={(e) => setSup(e.target.value)} min={0} />
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label htmlFor="med-inst" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Instructions</label>
            <textarea
              id="med-inst"
              value={inst}
              onChange={(e) => setInst(e.target.value)}
              placeholder="e.g. Take with food"
              rows={inst.length > 80 ? 4 : 2}
              className="fi w-full resize-y min-h-[2.5rem]"
            />
          </div>

          {/* Warnings */}
          <div>
            <label htmlFor="med-warn" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">Warnings</label>
            <textarea
              id="med-warn"
              value={warn}
              onChange={(e) => setWarn(e.target.value)}
              placeholder="e.g. May cause drowsiness"
              rows={warn.length > 80 ? 4 : 2}
              className="fi w-full resize-y min-h-[2.5rem]"
            />
          </div>

          <Button type="submit" variant="primary" size="md" className="mt-1" disabled={isSaving || isLooking}>
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-2 border-t-white rounded-full spin-loading shrink-0" />
                Saving...
              </span>
            ) : (
              'Add Medication'
            )}
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

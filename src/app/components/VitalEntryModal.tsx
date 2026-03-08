import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import type { VitalCreateInput } from '@/shared/services/vitals'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VitalEntryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: VitalCreateInput) => void
  isSubmitting?: boolean
  initialValues?: Partial<VitalCreateInput>
  editId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowLocal(): string {
  return new Date().toISOString().slice(0, 16)
}

function toNum(val: string): number | null {
  const trimmed = val.trim()
  if (trimmed === '') return null
  const n = parseFloat(trimmed)
  return isNaN(n) ? null : n
}

function toInt(val: string): number | null {
  const trimmed = val.trim()
  if (trimmed === '') return null
  const n = parseInt(trimmed, 10)
  return isNaN(n) ? null : n
}

function fromNum(val: number | null | undefined): string {
  return val == null ? '' : String(val)
}

// ---------------------------------------------------------------------------
// Label + Section header sub-components
// ---------------------------------------------------------------------------

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)] font-semibold mb-1.5 block"
    >
      {children}
    </label>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[var(--color-text-primary)] [font-size:var(--text-label)] font-bold mb-3 mt-4 first:mt-0">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VitalEntryModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  initialValues,
  editId,
}: VitalEntryModalProps) {
  const isEditing = Boolean(editId)

  // ---- field state --------------------------------------------------------

  const [recordedAt, setRecordedAt] = useState(nowLocal)
  const [bpSystolic, setBpSystolic] = useState('')
  const [bpDiastolic, setBpDiastolic] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [glucose, setGlucose] = useState('')
  const [weight, setWeight] = useState('')
  const [temperature, setTemperature] = useState('')
  const [o2Saturation, setO2Saturation] = useState('')
  const [notes, setNotes] = useState('')

  const [validationError, setValidationError] = useState<string | null>(null)

  // ---- populate from initialValues when modal opens ----------------------
  // Capture initialValues in a ref so the effect that runs on `open` can read
  // the latest prop values without needing to list them as dependencies.
  // The intent is a controlled initialization pattern: reset fields each time
  // the modal opens using whatever initialValues were passed at that moment.
  const initialValuesRef = useRef(initialValues)

  useEffect(() => {
    if (!open) return
    initialValuesRef.current = initialValues
    const iv = initialValuesRef.current
    setRecordedAt(iv?.recorded_at?.slice(0, 16) ?? nowLocal())
    setBpSystolic(fromNum(iv?.bp_systolic))
    setBpDiastolic(fromNum(iv?.bp_diastolic))
    setHeartRate(fromNum(iv?.heart_rate))
    setGlucose(fromNum(iv?.glucose))
    setWeight(fromNum(iv?.weight))
    setTemperature(fromNum(iv?.temperature))
    setO2Saturation(fromNum(iv?.o2_saturation))
    setNotes(iv?.notes ?? '')
    setValidationError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: initialValues captured via ref to reset form on open without re-triggering on every prop change
  }, [open])

  // ---- submit -------------------------------------------------------------

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const sys = toInt(bpSystolic)
    const dia = toInt(bpDiastolic)
    const hr = toInt(heartRate)
    const gluc = toNum(glucose)
    const wt = toNum(weight)
    const temp = toNum(temperature)
    const o2 = toInt(o2Saturation)

    const hasVital =
      sys !== null ||
      dia !== null ||
      hr !== null ||
      gluc !== null ||
      wt !== null ||
      temp !== null ||
      o2 !== null

    if (!hasVital) {
      setValidationError('Please enter at least one vital measurement.')
      return
    }

    setValidationError(null)

    const payload: VitalCreateInput = {
      recorded_at: recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString(),
      bp_systolic: sys,
      bp_diastolic: dia,
      heart_rate: hr,
      glucose: gluc,
      weight: wt,
      temperature: temp,
      o2_saturation: o2,
      notes: notes.trim() === '' ? null : notes.trim(),
    }

    onSubmit(payload)
  }

  // ---- render -------------------------------------------------------------

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Entry' : 'Log Vitals'}
      variant="responsive"
      description="Enter one or more vital measurements to record."
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* Scrollable field area */}
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain pr-0.5">

          {/* Date / time */}
          <div className="mb-4 mt-1">
            <FieldLabel htmlFor="vital-recorded-at">Date &amp; Time</FieldLabel>
            <Input
              id="vital-recorded-at"
              type="datetime-local"
              value={recordedAt}
              onChange={e => setRecordedAt(e.target.value)}
            />
          </div>

          {/* Blood Pressure */}
          <SectionHeader>Blood Pressure (mmHg)</SectionHeader>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <FieldLabel htmlFor="vital-bp-systolic">Systolic</FieldLabel>
              <Input
                id="vital-bp-systolic"
                type="number"
                inputMode="numeric"
                placeholder="120"
                min={40}
                max={300}
                value={bpSystolic}
                onChange={e => setBpSystolic(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <FieldLabel htmlFor="vital-bp-diastolic">Diastolic</FieldLabel>
              <Input
                id="vital-bp-diastolic"
                type="number"
                inputMode="numeric"
                placeholder="80"
                min={20}
                max={200}
                value={bpDiastolic}
                onChange={e => setBpDiastolic(e.target.value)}
              />
            </div>
          </div>

          {/* Heart Rate */}
          <SectionHeader>Heart Rate (BPM)</SectionHeader>
          <div className="mb-4">
            <Input
              id="vital-heart-rate"
              type="number"
              inputMode="numeric"
              placeholder="72"
              min={30}
              max={250}
              value={heartRate}
              onChange={e => setHeartRate(e.target.value)}
              aria-label="Heart Rate (BPM)"
            />
          </div>

          {/* Blood Glucose */}
          <SectionHeader>Blood Glucose (mg/dL)</SectionHeader>
          <div className="mb-4">
            <Input
              id="vital-glucose"
              type="number"
              inputMode="decimal"
              placeholder="100"
              min={20}
              max={600}
              step={0.1}
              value={glucose}
              onChange={e => setGlucose(e.target.value)}
              aria-label="Blood Glucose (mg/dL)"
            />
          </div>

          {/* Weight */}
          <SectionHeader>Weight (kg)</SectionHeader>
          <div className="mb-4">
            <Input
              id="vital-weight"
              type="number"
              inputMode="decimal"
              placeholder="70.0"
              min={10}
              max={500}
              step={0.1}
              value={weight}
              onChange={e => setWeight(e.target.value)}
              aria-label="Weight (kg)"
            />
          </div>

          {/* Temperature */}
          <SectionHeader>Temperature (°C)</SectionHeader>
          <div className="mb-4">
            <Input
              id="vital-temperature"
              type="number"
              inputMode="decimal"
              placeholder="37.0"
              min={30}
              max={45}
              step={0.1}
              value={temperature}
              onChange={e => setTemperature(e.target.value)}
              aria-label="Temperature (°C)"
            />
          </div>

          {/* O2 Saturation */}
          <SectionHeader>O₂ Saturation (%)</SectionHeader>
          <div className="mb-4">
            <Input
              id="vital-o2"
              type="number"
              inputMode="numeric"
              placeholder="98"
              min={50}
              max={100}
              value={o2Saturation}
              onChange={e => setO2Saturation(e.target.value)}
              aria-label="O₂ Saturation (%)"
            />
          </div>

          {/* Notes */}
          <SectionHeader>Notes</SectionHeader>
          <div className="mb-4">
            <textarea
              id="vital-notes"
              rows={2}
              placeholder="Optional notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="fi w-full resize-none"
              aria-label="Notes"
            />
          </div>

        </div>

        {/* Validation error */}
        {validationError && (
          <p
            role="alert"
            className="text-[var(--color-red)] [font-size:var(--text-caption)] mt-3 font-medium"
          >
            {validationError}
          </p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="mt-5"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : 'Save Entry'}
        </Button>
      </form>
    </Modal>
  )
}

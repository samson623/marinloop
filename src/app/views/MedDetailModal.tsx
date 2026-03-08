import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppStore, fT } from '@/shared/stores/app-store'
import { Modal } from '@/shared/components/Modal'
import { ConfirmDeleteModal } from '@/shared/components/ConfirmDeleteModal'
import { Button, Input } from '@/shared/components/ui'
import { generateEvenlySpacedTimes } from '@/shared/lib/scheduling'
import { getSupplyInfo } from '@/shared/lib/medication-utils'
import { useInteractions } from '@/shared/hooks/useInteractions'
import { getTimingPatterns } from '@/shared/services/schedule-analysis'
import { getOpenFDALabel, getIngredients } from '@/shared/services/rxnorm'
import { SymptomsService } from '@/shared/services/symptoms'
import type { Symptom } from '@/shared/services/symptoms'
import { SymptomModal } from '@/app/components/SymptomModal'

type DisplayMed = {
  id: string
  name: string
  dose: string
  freq: number
  times: string[]
  instructions: string
  warnings: string
  supply: number
  total: number
  dosesPerDay: number
  rxcui?: string | null
}

type MedRef = { id: string; name: string; rxcui?: string | null }

function FormField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex-1">
      <label htmlFor={id} className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">
        {label}
      </label>
      {children}
    </div>
  )
}

export default function MedDetailModal({ med, isDeleting, onClose, onUpdate, onDelete, onDiscontinue, onUpdateSupply, refills, scheds, addSchedAsync, updateSched, deleteSched, allMeds, userAllergies }: {
  med: DisplayMed
  isDeleting: boolean
  onClose: () => void
  onUpdate: (id: string, updates: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onDiscontinue?: (id: string, reason?: string) => Promise<void>
  onUpdateSupply: (refillId: string, qty: number) => void
  refills: Array<{ id: string; medication_id: string; current_quantity: number; total_quantity: number }>
  scheds: Array<{ id: string; medication_id: string; time: string; days: number[]; food_context_minutes: number; active: boolean }>
  addSchedAsync: (input: { medication_id: string; time: string; days: number[]; food_context_minutes: number; active: boolean }) => Promise<unknown>
  updateSched: (input: { id: string; updates: Record<string, unknown> }) => void
  deleteSched: (id: string) => void
  allMeds: MedRef[]
  userAllergies?: string[]
}) {
  const { toast } = useAppStore()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDiscontinueReason, setShowDiscontinueReason] = useState(false)
  const [discontinueReason, setDiscontinueReason] = useState('')
  const [showSymptomModal, setShowSymptomModal] = useState(false)
  const queryClient = useQueryClient()
  const [editingSupply, setEditingSupply] = useState(false)
  const [supplyVal, setSupplyVal] = useState(String(med.supply))

  // Edit form state — initialized from current medication data
  const [editName, setEditName] = useState(med.name)
  const [editDose, setEditDose] = useState(med.dose)
  const [editFreq, setEditFreq] = useState(String(med.freq))
  const [editTimes, setEditTimes] = useState<string[]>(med.times.length > 0 ? med.times : ['08:00'])
  const [editSup, setEditSup] = useState(String(med.supply))
  const [editInst, setEditInst] = useState(med.instructions)
  const [editWarn, setEditWarn] = useState(med.warnings)

  const { pct: p, days, color: barColor } = getSupplyInfo(med.supply, med.total, med.dosesPerDay)

  const refill = refills.find((r) => r.medication_id === med.id)
  const medScheds = scheds.filter((s) => s.medication_id === med.id).sort((a, b) => a.time.localeCompare(b.time))

  // Drug interactions — exclude this med from the list passed to the hook
  const otherMeds = allMeds.filter((m) => m.id !== med.id)
  const thisMedRef: MedRef = { id: med.id, name: med.name }
  const medsForInteractions = [thisMedRef, ...otherMeds]
  const { interactions, isLoading: interactionsLoading } = useInteractions(medsForInteractions)

  // Timing insight — query timing patterns for this medication
  const { data: timingPatterns } = useQuery({
    queryKey: ['timing-patterns', med.id],
    queryFn: () => getTimingPatterns(med.id),
    staleTime: 30 * 60 * 1000,
  })

  // Side effects logged for this medication
  const { data: medSymptoms = [] } = useQuery({
    queryKey: ['symptoms', 'by-med', med.id],
    queryFn: () => SymptomsService.getByMedication(med.id),
    staleTime: 1000 * 60 * 5,
  })

  // OpenFDA food interactions (fetched lazily when rxcui is available)
  const { data: fdaLabel } = useQuery({
    queryKey: ['fda-label', med.rxcui],
    queryFn: () => getOpenFDALabel(med.rxcui!),
    enabled: !!med.rxcui,
    staleTime: 60 * 60 * 1000, // 1h
    retry: false,
  })

  // Ingredient-level allergy check via RxNav
  const { data: ingredients = [] } = useQuery({
    queryKey: ['ingredients', med.rxcui],
    queryFn: () => getIngredients(med.rxcui!),
    enabled: !!med.rxcui && (userAllergies?.length ?? 0) > 0,
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  // Allergy check — 1) warning text match, 2) ingredient-level match
  const matchedAllergen = (() => {
    if (!userAllergies || userAllergies.length === 0) return undefined
    // Ingredient-level match (higher fidelity)
    const ingredientMatch = ingredients.find((ing) =>
      userAllergies.some((allergy) => ing.toLowerCase().includes(allergy.toLowerCase()) || allergy.toLowerCase().includes(ing.toLowerCase()))
    )
    if (ingredientMatch) return ingredientMatch
    // Fallback: warning text match
    if (med.warnings) {
      return userAllergies.find((allergy) => med.warnings.toLowerCase().includes(allergy.toLowerCase()))
    }
    return undefined
  })()

  const handleEditFreqChange = (newFreq: string) => {
    const n = Number.parseInt(newFreq, 10) || 1
    setEditFreq(newFreq)
    setEditTimes((prev) => {
      if (prev.length === n) return prev
      if (prev.length < n) return generateEvenlySpacedTimes(n, prev[0])
      return prev.slice(0, n)
    })
  }

  const updateEditTimeAtIndex = (index: number, value: string) => {
    setEditTimes((prev) => prev.map((v, i) => (i === index ? value : v)))
  }

  const handleSaveEdit = async () => {
    const newFreq = Number.parseInt(editFreq, 10) || 1
    const newSup = Math.max(0, parseInt(editSup, 10) || 0)

    // 1. Update medication record
    onUpdate(med.id, {
      name: editName,
      dosage: editDose,
      freq: newFreq,
      instructions: editInst,
      warnings: editWarn,
    })

    // 2. Update schedules: match existing schedules to new times
    try {
      // Update existing schedules that still have a matching time slot
      for (let i = 0; i < Math.min(medScheds.length, editTimes.length); i++) {
        if (medScheds[i].time.slice(0, 5) !== editTimes[i]) {
          updateSched({ id: medScheds[i].id, updates: { time: editTimes[i] } })
        }
      }
      // Create new schedules if frequency increased
      for (let i = medScheds.length; i < editTimes.length; i++) {
        await addSchedAsync({
          medication_id: med.id,
          time: editTimes[i],
          days: [0, 1, 2, 3, 4, 5, 6],
          food_context_minutes: 0,
          active: true,
        })
      }
      // Delete extra schedules if frequency decreased
      for (let i = editTimes.length; i < medScheds.length; i++) {
        deleteSched(medScheds[i].id)
      }
      toast('Medication updated', 'ts')
    } catch {
      toast('Failed to update some schedules', 'te')
    }

    // 3. Update supply/refill
    if (refill && newSup !== med.supply) {
      onUpdateSupply(refill.id, newSup)
    }
  }

  const handleSaveSupply = () => {
    if (!refill) return
    const qty = Math.max(0, parseInt(supplyVal, 10) || 0)
    onUpdateSupply(refill.id, qty)
    setEditingSupply(false)
  }

  if (isEditing) {
    return (
      <Modal open onOpenChange={(o) => !o && setIsEditing(false)} title="Edit Medication" variant="responsive">
        <form onSubmit={(e) => { e.preventDefault(); void handleSaveEdit() }}>
          <FormField label="Name" id="edit-med-name">
            <Input id="edit-med-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Dosage" id="edit-med-dose">
              <Input id="edit-med-dose" value={editDose} onChange={(e) => setEditDose(e.target.value)} placeholder="e.g. 500mg" />
            </FormField>
            <FormField label="Frequency" id="edit-med-freq">
              <select
                id="edit-med-freq"
                value={editFreq}
                onChange={(e) => handleEditFreqChange(e.target.value)}
                className="fi w-full cursor-pointer"
              >
                <option value="1">Once daily</option>
                <option value="2">Twice daily</option>
                <option value="3">Three times daily</option>
              </select>
            </FormField>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">Schedule & Supply</span>
              <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              {editTimes.map((t, i) => (
                <div key={i}>
                  <label htmlFor={`edit-med-time-${i}`} className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">
                    {editTimes.length > 1 ? `Time ${i + 1}` : 'Time'}
                  </label>
                  <Input type="time" id={`edit-med-time-${i}`} value={t} onChange={(e) => updateEditTimeAtIndex(i, e.target.value)} />
                </div>
              ))}
              <div>
                <label htmlFor="edit-med-sup" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">
                  Pills in Bottle
                </label>
                <Input type="number" id="edit-med-sup" value={editSup} onChange={(e) => setEditSup(e.target.value)} min={0} />
              </div>
            </div>
          </div>

          <FormField label="Instructions" id="edit-med-inst">
            <textarea id="edit-med-inst" value={editInst} onChange={(e) => setEditInst(e.target.value)} rows={3} className="fi w-full resize-y min-h-[2.5rem]" placeholder="e.g. Take with food" />
          </FormField>
          <FormField label="Warnings" id="edit-med-warn">
            <textarea id="edit-med-warn" value={editWarn} onChange={(e) => setEditWarn(e.target.value)} rows={3} className="fi w-full resize-y min-h-[2.5rem]" placeholder="e.g. May cause drowsiness" />
          </FormField>

          <div className="flex gap-3 mt-2">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="md" className="flex-1">Save Changes</Button>
          </div>
        </form>
      </Modal>
    )
  }

  return (
    <>
      <Modal open onOpenChange={(o) => !o && onClose()} title={med.name} variant="center" closeLabel="Close">
        <div className="rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] p-6 sm:p-8 -mt-2 -mx-2 sm:-mx-4">
          <div className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] font-semibold mb-6">
            {med.dose || 'No dosage specified'}
          </div>

          <div className="space-y-5 [font-size:var(--text-body)]">
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-text-tertiary)] shrink-0 w-28">Schedule</span>
              <span className="text-[var(--color-text-primary)]">
                {med.times.length > 0 ? med.times.map((t) => fT(t)).join(', ') : 'No time set'}
              </span>
            </div>

            {/* Timing Insight — shown below the schedule row */}
            {timingPatterns && timingPatterns.length > 0 && (
              <div className="ml-28 -mt-2">
                {timingPatterns.map((pattern) => (
                  <div
                    key={pattern.scheduleId}
                    className="flex items-center gap-2 flex-wrap text-[var(--color-text-secondary)] [font-size:var(--text-caption)] bg-[var(--color-bg-tertiary)] rounded-lg px-3 py-2 mb-1.5"
                  >
                    <span>
                      You usually take this at <strong className="text-[var(--color-text-primary)]">{fT(pattern.avgActualTime)}</strong>
                      {' '}— want to reschedule from <strong className="text-[var(--color-text-primary)]">{fT(pattern.scheduledTime)}</strong>?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        updateSched({ id: pattern.scheduleId, updates: { time: pattern.avgActualTime } })
                        toast(`Schedule updated to ${fT(pattern.avgActualTime)}`, 'ts')
                      }}
                      className="shrink-0 text-[var(--color-accent)] font-semibold [font-size:var(--text-caption)] cursor-pointer hover:underline"
                    >
                      Reschedule
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-3">
              <span className="text-[var(--color-text-tertiary)] shrink-0 w-28">Frequency</span>
              <span className="text-[var(--color-text-primary)]">{med.freq}x daily</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[var(--color-text-tertiary)] shrink-0 w-28">Supply</span>
              <div className="flex items-center gap-2">
                {editingSupply ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={supplyVal}
                      onChange={(e) => setSupplyVal(e.target.value)}
                      min={0}
                      className="w-20 !py-1 !px-2 [font-size:var(--text-body)]"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSupply(); if (e.key === 'Escape') setEditingSupply(false) }}
                    />
                    <button type="button" onClick={handleSaveSupply} className="text-[var(--color-accent)] font-bold [font-size:var(--text-caption)] cursor-pointer">Save</button>
                    <button type="button" onClick={() => setEditingSupply(false)} className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] cursor-pointer">Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="text-[var(--color-text-primary)]">
                      {med.supply} of {med.total} pills · {days} days left
                      {days <= 5 && <span className="text-[var(--color-red)] font-bold"> — Refill soon</span>}
                    </span>
                    {refill && (
                      <button
                        type="button"
                        onClick={() => { setSupplyVal(String(med.supply)); setEditingSupply(true) }}
                        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] cursor-pointer transition-colors"
                        aria-label="Update supply count"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {med.instructions && (
              <div className="flex items-start gap-3">
                <span className="text-[var(--color-text-tertiary)] shrink-0 w-28">Instructions</span>
                <p className="text-[var(--color-text-primary)] leading-relaxed">{med.instructions}</p>
              </div>
            )}
            {med.warnings && (
              <div className="flex items-start gap-3">
                <span className="text-[var(--color-text-tertiary)] shrink-0 w-28">Warnings</span>
                <p className="text-[var(--color-red)] font-medium leading-relaxed">{med.warnings}</p>
              </div>
            )}

            {/* Food & Drug Interactions from OpenFDA label */}
            {fdaLabel?.foodInteractions && (
              <div className="flex items-start gap-3">
                <span className="text-[var(--color-text-tertiary)] shrink-0 w-28">Food Note</span>
                <p className="text-[var(--color-text-secondary)] leading-relaxed [font-size:var(--text-label)]">{fdaLabel.foodInteractions}</p>
              </div>
            )}

            {/* Allergy Alert — shown after warnings */}
            {matchedAllergen && (
              <div role="alert" className="mb-4 px-4 py-3 rounded-xl border-l-4 bg-[color-mix(in_srgb,var(--color-red)_8%,var(--color-bg-secondary))] border-[var(--color-red)] flex items-start gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div>
                  <div className="font-bold text-[var(--color-red)] [font-size:var(--text-body)]">Allergy Alert</div>
                  <div className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)] mt-0.5">
                    This medication may contain <strong>{matchedAllergen}</strong>, which matches your known allergies. Consult your healthcare provider before taking this medication.
                  </div>
                </div>
              </div>
            )}

            {/* Drug Interactions */}
            {interactionsLoading && (
              <div className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] italic">
                Checking interactions...
              </div>
            )}
            {!interactionsLoading && interactions.length > 0 && (
              <div
                className={[
                  'rounded-xl border px-4 py-3 space-y-2',
                  interactions.some((i) => i.severity === 'high')
                    ? 'border-[color-mix(in_srgb,var(--color-red)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]'
                    : 'border-[color-mix(in_srgb,var(--color-amber,#f59e0b)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-amber,#f59e0b)_8%,transparent)]',
                ].join(' ')}
              >
                <div className="flex items-center gap-2">
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={interactions.some((i) => i.severity === 'high') ? 'var(--color-red)' : '#f59e0b'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span
                    className={[
                      'font-semibold [font-size:var(--text-body)]',
                      interactions.some((i) => i.severity === 'high') ? 'text-[var(--color-red)]' : 'text-[#b45309]',
                    ].join(' ')}
                  >
                    Drug Interactions
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {interactions.map((interaction, idx) => (
                    <li key={idx} className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)] leading-relaxed">
                      {interaction.description}
                    </li>
                  ))}
                </ul>
                <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mt-2">Review these interactions with your pharmacist or healthcare provider.</p>
              </div>
            )}
          </div>

          {/* Side Effects */}
          <div className="mt-5 pt-4 border-t border-[var(--color-border-primary)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[var(--color-text-secondary)] [font-size:var(--text-label)] font-semibold">Side Effects</span>
              <button
                type="button"
                onClick={() => setShowSymptomModal(true)}
                className="text-[var(--color-accent)] [font-size:var(--text-caption)] font-semibold cursor-pointer hover:underline bg-transparent border-none p-0"
              >
                + Log
              </button>
            </div>
            {medSymptoms.length === 0 ? (
              <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] italic">No side effects logged for this medication.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {medSymptoms.slice(0, 5).map((s: Symptom) => {
                  const severityColor = s.severity <= 3 ? 'var(--color-green)' : s.severity <= 6 ? '#f59e0b' : 'var(--color-red)'
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--color-border-secondary)] last:border-0">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-[var(--color-text-primary)] [font-size:var(--text-body)]">{s.name}</span>
                        {s.resolved_at ? (
                          <span className="ml-2 text-[var(--color-green)] [font-size:var(--text-caption)] font-medium">· Resolved</span>
                        ) : (
                          <span className="ml-2 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">· Ongoing</span>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-bold" style={{ color: severityColor }}>{s.severity}/10</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Supply bar */}
          <div className="mt-6 pt-5 border-t border-[var(--color-border-primary)]">
            <div className="h-3 bg-[var(--color-ring-track)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${p}%`, background: barColor }}
              />
            </div>
            <div className="flex justify-between mt-2 [font-size:var(--text-caption)] text-[var(--color-text-secondary)] [font-family:var(--font-mono)]">
              <span>Supply remaining</span>
              <span>{Math.round(p)}%</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 pt-4 border-t border-[var(--color-border-primary)] flex flex-col gap-2">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-[var(--color-accent)] bg-[var(--color-accent-bg)] border border-[var(--color-green-border)] cursor-pointer transition-all hover:brightness-105 active:scale-[0.97] [font-size:var(--text-body)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
              {onDiscontinue && (
                <button
                  type="button"
                  onClick={() => setShowDiscontinueReason(true)}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-[var(--color-amber,#d97706)] bg-[color-mix(in_srgb,#d97706_8%,transparent)] border border-[color-mix(in_srgb,#d97706_20%,transparent)] cursor-pointer transition-all hover:brightness-105 active:scale-[0.97] [font-size:var(--text-body)] disabled:opacity-50"
                >
                  Discontinue
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-[var(--color-text-tertiary)] border border-[var(--color-border-secondary)] cursor-pointer transition-all hover:text-[var(--color-red)] hover:border-[color-mix(in_srgb,var(--color-red)_30%,transparent)] active:scale-[0.97] [font-size:var(--text-label)]"
            >
              Delete permanently
            </button>
          </div>
        </div>
      </Modal>

      <SymptomModal
        open={showSymptomModal}
        onOpenChange={setShowSymptomModal}
        medicationId={med.id}
        medicationName={med.name}
        onSubmit={async (data) => {
          await SymptomsService.create(data)
          void queryClient.invalidateQueries({ queryKey: ['symptoms', 'by-med', med.id] })
          void queryClient.invalidateQueries({ queryKey: ['symptoms'] })
          toast('Side effect logged', 'ts')
          setShowSymptomModal(false)
        }}
      />

      <ConfirmDeleteModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemName={med.name}
        description="This will permanently delete all dose history, schedule, and refill data. This cannot be undone. Consider 'Discontinue' to preserve history."
        onConfirm={() => onDelete(med.id)}
        isPending={isDeleting}
      />

      {showDiscontinueReason && onDiscontinue && (
        <Modal open onOpenChange={(o) => !o && setShowDiscontinueReason(false)} title="Discontinue Medication" variant="center">
          <p className="text-[var(--color-text-secondary)] [font-size:var(--text-body)] mb-4">
            <strong>{med.name}</strong> will be archived. All dose history is preserved and can be restored later.
          </p>
          <label htmlFor="discontinue-reason" className="block font-bold text-[var(--color-text-secondary)] mb-1.5 [font-size:var(--text-label)]">
            Reason (optional)
          </label>
          <Input
            id="discontinue-reason"
            value={discontinueReason}
            onChange={(e) => setDiscontinueReason(e.target.value)}
            placeholder="e.g. Course completed, side effects, switched medication"
            className="mb-4"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={isDeleting}
              onClick={async () => {
                await onDiscontinue(med.id, discontinueReason || undefined)
                setShowDiscontinueReason(false)
              }}
            >
              Discontinue
            </Button>
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => setShowDiscontinueReason(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}

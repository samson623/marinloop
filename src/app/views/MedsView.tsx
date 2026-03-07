import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore, fT } from '@/shared/stores/app-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useMedications } from '@/shared/hooks/useMedications'
import { useSchedules } from '@/shared/hooks/useSchedules'
import { useRefills } from '@/shared/hooks/useRefillsList'
import { useAppointments } from '@/shared/hooks/useAppointments'
import { Button } from '@/shared/components/ui'
import { getSupplyInfo } from '@/shared/lib/medication-utils'
import { MedsService } from '@/shared/services/medications'
import MedDetailModal from './MedDetailModal'
import AddMedModal from './AddMedModal'

function MedCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-border-primary)] p-5 bg-[var(--color-bg-secondary)] animate-pulse mb-4">
      <div className="flex items-start gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="h-4 w-1/2 rounded bg-[var(--color-bg-tertiary)] mb-2" />
          <div className="h-3 w-1/4 rounded bg-[var(--color-bg-tertiary)]" />
        </div>
        <div className="h-7 w-16 rounded-lg bg-[var(--color-bg-tertiary)] shrink-0" />
      </div>
      <div className="flex gap-5 mb-4">
        <div className="h-3 w-24 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-3 w-16 rounded bg-[var(--color-bg-tertiary)]" />
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--color-bg-tertiary)]" />
      <div className="flex justify-between mt-2">
        <div className="h-3 w-20 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="h-3 w-16 rounded bg-[var(--color-bg-tertiary)]" />
      </div>
    </div>
  )
}

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

type MedsTab = 'active' | 'archived'

export function MedsView() {
  const {
    showAddMedModal,
    draftMed,
    addMedModalOptions,
    openAddMedModal,
    closeAddMedModal,
  } = useAppStore()
  const [selectedMed, setSelectedMed] = useState<DisplayMed | null>(null)
  const [activeTab, setActiveTab] = useState<MedsTab>('active')
  const { profile } = useAuthStore()
  const userAllergies = profile?.allergies ?? []
  const { meds: realMeds, isLoading: medsLoading, addMedBundleAsync, updateMed, deleteMed, discontinueMedAsync, restoreMed, isAdding, isDeleting, isDiscontinuing } = useMedications()
  const { scheds, addSchedAsync, updateSched, deleteSched } = useSchedules()
  const { refills, updateRefill } = useRefills()
  const { appts } = useAppointments()

  const { data: archivedMeds = [], isLoading: archivedLoading } = useQuery({
    queryKey: ['medications', 'archived'],
    queryFn: MedsService.getArchived,
    enabled: activeTab === 'archived',
    staleTime: 5 * 60 * 1000,
  })

  const toDisplayMed = (m: typeof realMeds[0]): DisplayMed => {
    const myScheds = scheds.filter((s) => s.medication_id === m.id)
    const times = myScheds.map((s) => s.time.slice(0, 5))
    const refill = refills.find((r) => r.medication_id === m.id)
    const supply = refill?.current_quantity ?? 0
    const total = refill?.total_quantity ?? 30
    const dosesPerDay = m.freq || 1
    return {
      id: m.id,
      name: m.name,
      dose: m.dosage || '',
      freq: m.freq,
      times,
      instructions: m.instructions || '',
      warnings: m.warnings || '',
      supply,
      total,
      dosesPerDay,
      rxcui: m.rxcui,
    }
  }

  const displayMeds = realMeds.map(toDisplayMed)

  return (
    <div className="animate-view-in w-full max-w-[480px] mx-auto">
      <h2 className="font-extrabold tracking-[-0.02em] mb-4 text-[var(--color-text-primary)] text-xl sm:[font-size:var(--text-title)]">
        Medications
      </h2>

      {/* Active / Archived tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-primary)]">
        {(['active', 'archived'] as MedsTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer border-none ${
              activeTab === tab
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab === 'active' ? 'Active' : `Archived${archivedMeds.length > 0 ? ` (${archivedMeds.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── Archived tab ── */}
      {activeTab === 'archived' && (
        archivedLoading ? (
          <div role="status" aria-live="polite" aria-label="Loading archived medications">
            <MedCardSkeleton /><MedCardSkeleton />
          </div>
        ) : archivedMeds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-[var(--color-text-primary)] font-semibold text-lg mb-2">No archived medications</p>
            <p className="text-[var(--color-text-secondary)] text-sm max-w-xs leading-relaxed">
              Discontinued medications appear here. History is never deleted.
            </p>
          </div>
        ) : (
          <div className="stagger-children" role="list">
            {archivedMeds.map((m, i) => (
              <div
                key={m.id}
                role="listitem"
                className="animate-slide-r bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-2xl p-5 mb-4 opacity-60"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <span className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-body)] leading-snug line-through">{m.name}</span>
                    {m.dosage && <span className="ml-2 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">{m.dosage}</span>}
                  </div>
                  <span className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] shrink-0">
                    {m.discontinued_at ? new Date(m.discontinued_at).toLocaleDateString() : ''}
                  </span>
                </div>
                {m.discontinuation_reason && (
                  <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mb-3">{m.discontinuation_reason}</p>
                )}
                <button
                  type="button"
                  onClick={() => restoreMed(m.id)}
                  className="text-[var(--color-accent)] [font-size:var(--text-caption)] font-semibold cursor-pointer bg-transparent border-none underline"
                >
                  Restore to active
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Active tab ── */}
      {activeTab === 'active' && (medsLoading ? (
        <div role="status" aria-live="polite" aria-label="Loading medications">
          <MedCardSkeleton />
          <MedCardSkeleton />
          <MedCardSkeleton />
        </div>
      ) : (
      <div className="stagger-children" role="list">
        {displayMeds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <svg
              width="64" height="64" viewBox="0 0 24 24"
              fill="none" stroke="var(--color-accent)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
              className="mb-4 opacity-70" aria-hidden="true"
            >
              <path d="M12 2a4 4 0 0 1 4 4v12a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            <p className="text-[var(--color-text-primary)] font-semibold text-lg mb-2">No medications yet</p>
            <p className="text-[var(--color-text-secondary)] text-sm mb-6 max-w-xs leading-relaxed">
              Add your first medication to start tracking doses, refills, and your adherence.
            </p>
            <Button type="button" variant="primary" size="md" onClick={() => openAddMedModal(null)} className="flex items-center justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Medication
            </Button>
          </div>
        )}

        {displayMeds.map((m, i) => {
          const { pct: p, days, color: sc } = getSupplyInfo(m.supply, m.total, m.dosesPerDay)
          const isLowSupply = m.total > 0 && m.supply / m.total < 0.2

          return (
            <button
              key={m.id}
              type="button"
              role="listitem"
              tabIndex={0}
              aria-label={`${m.name}${m.dose ? ', ' + m.dose : ''}, ${m.freq}x daily`}
              className="animate-slide-r card-interactive w-full text-left bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] rounded-2xl p-5 mb-4 min-h-[88px] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              style={{ animationDelay: `${i * 0.04}s` }}
              onClick={() => setSelectedMed(m)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedMed(m) } }}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <span className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-body)] leading-snug">{m.name}</span>
                <span className="text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] py-1.5 px-3 rounded-lg [font-family:var(--font-mono)] [font-size:var(--text-caption)] shrink-0 font-semibold">{m.dose}</span>
              </div>
              <div className="flex flex-wrap gap-5 text-[var(--color-text-secondary)] [font-size:var(--text-label)]">
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {m.times.length > 0 ? m.times.map((t) => fT(t)).join(', ') : 'No time set'}
                </span>
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
                  {m.freq}x daily
                </span>
              </div>
              <div
                className="mt-4 h-2 bg-[var(--color-ring-track)] rounded-full overflow-hidden"
                aria-label={`${m.supply} of ${m.total} pills remaining`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${p}%`, background: sc }}
                />
              </div>
              <div className="text-[var(--color-text-secondary)] mt-2 flex justify-between [font-family:var(--font-mono)] [font-size:var(--text-caption)] font-medium">
                <span className="flex items-center gap-1">
                  {m.supply} pills left
                  {isLowSupply && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-[var(--color-red)] animate-pulse ml-1"
                      aria-label="Low supply warning"
                    />
                  )}
                </span>
                <span className={days <= 5 ? 'text-[var(--color-red)] font-bold' : ''}>{days} days{days <= 5 ? ' — Refill soon' : ''}</span>
              </div>
            </button>
          )
        })}
      </div>
      ))}

      {activeTab === 'active' && (
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
      )}

      {selectedMed && (
        <MedDetailModal
          med={selectedMed}
          isDeleting={isDeleting || isDiscontinuing}
          onClose={() => setSelectedMed(null)}
          onUpdate={(id, updates) => {
            updateMed({ id, updates })
            setSelectedMed(null)
          }}
          onDelete={(id) => {
            deleteMed(id)
            setSelectedMed(null)
          }}
          onDiscontinue={async (id, reason) => {
            await discontinueMedAsync({ id, reason })
            setSelectedMed(null)
          }}
          onUpdateSupply={(refillId, qty) => {
            updateRefill({ id: refillId, updates: { current_quantity: qty } })
          }}
          refills={refills}
          scheds={scheds}
          addSchedAsync={addSchedAsync}
          updateSched={updateSched}
          deleteSched={deleteSched}
          allMeds={realMeds.map((m) => ({ id: m.id, name: m.name, rxcui: m.rxcui }))}
          userAllergies={userAllergies}
        />
      )}

      {showAddMedModal && (
        <AddMedModal
          onClose={closeAddMedModal}
          createBundleAsync={addMedBundleAsync}
          isSaving={isAdding}
          initialDraft={draftMed}
          openScanner={addMedModalOptions?.openScanner}
          openPhoto={addMedModalOptions?.openPhoto}
          allMeds={realMeds.map((m) => ({ id: m.id, name: m.name, rxcui: m.rxcui }))}
          upcomingAppts={appts.map((a) => ({ title: a.title, start_time: a.start_time, commute_minutes: a.commute_minutes }))}
          userAllergies={userAllergies}
        />
      )}
    </div>
  )
}

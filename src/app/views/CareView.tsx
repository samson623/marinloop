import { useState } from 'react'
import { useCareNetwork } from '@/shared/hooks/useCareNetwork'
import { useProviders } from '@/shared/hooks/useProviders'
import { useEmergencyContacts } from '@/shared/hooks/useEmergencyContacts'
import { Button, Card, Input } from '@/shared/components/ui'
import { UpgradePrompt } from '@/shared/components/UpgradePrompt'
import { useSubscription } from '@/shared/hooks/useSubscription'
import { SkeletonCard } from '@/shared/components/Skeleton'
import { cn } from '@/shared/lib/utils'
import type {
  CareConnection,
  Provider,
  EmergencyContact,
  ProviderSpecialty,
  CareRelationship,
} from '@/shared/types/care-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIALTY_LABELS: Record<ProviderSpecialty, string> = {
  primary_care: 'Primary Care',
  cardiologist: 'Cardiologist',
  pharmacist: 'Pharmacist',
  neurologist: 'Neurologist',
  specialist: 'Specialist',
  other: 'Other',
}

const SPECIALTY_COLORS: Record<ProviderSpecialty, string> = {
  primary_care: 'bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]',
  cardiologist: 'bg-[color-mix(in_srgb,var(--color-red)_12%,transparent)] text-[var(--color-red)]',
  pharmacist: 'bg-[color-mix(in_srgb,var(--color-green)_12%,transparent)] text-[var(--color-green)]',
  neurologist: 'bg-[color-mix(in_srgb,var(--color-purple,#7c3aed)_12%,transparent)] text-[var(--color-purple,#7c3aed)]',
  specialist: 'bg-[color-mix(in_srgb,var(--color-orange,#ea580c)_12%,transparent)] text-[var(--color-orange,#ea580c)]',
  other: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
}

const RELATIONSHIP_LABELS: Record<CareRelationship, string> = {
  spouse: 'Spouse',
  parent: 'Parent',
  child: 'Child',
  friend: 'Friend',
  nurse: 'Nurse',
  other: 'Other',
}

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  revoked: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]',
}

// ─── Sub-component: FormGroup ─────────────────────────────────────────────────

function FG({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex-1">
      <label
        htmlFor={id}
        className="block font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-[0.08em] [font-size:var(--text-label)]"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Sub-component: SelectInput ───────────────────────────────────────────────

function SelectInput({
  id,
  value,
  onChange,
  children,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="fi w-full py-3 px-3.5 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] text-[var(--color-text-primary)] [font-size:var(--text-body)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      {children}
    </select>
  )
}

// ─── Sub-component: IconDelete ────────────────────────────────────────────────

function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)] border border-[color-mix(in_srgb,var(--color-red)_20%,transparent)] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] hover:opacity-90 active:scale-95 transition-transform"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  )
}

// ─── Empty States ─────────────────────────────────────────────────────────────

function EmptyProviders() {
  return (
    <div className="empty-state flex flex-col items-center gap-3">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
      <div>
        <p className="text-[var(--color-text-primary)] font-semibold text-lg leading-snug">No providers added yet</p>
        <p className="mt-1 text-[var(--color-text-secondary)] text-sm max-w-xs">
          Add your doctors, pharmacists, and specialists to keep your care team in one place.
        </p>
      </div>
    </div>
  )
}

function EmptyCaregivers() {
  return (
    <div className="empty-state flex flex-col items-center gap-3">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <div>
        <p className="text-[var(--color-text-primary)] font-semibold text-lg leading-snug">No caregivers yet</p>
        <p className="mt-1 text-[var(--color-text-secondary)] text-sm max-w-xs">
          Invite trusted family members or friends to support your care and stay informed.
        </p>
      </div>
    </div>
  )
}

function EmptyEmergency() {
  return (
    <div className="empty-state flex flex-col items-center gap-3">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 14 19.79 19.79 0 0 1 1.61 5.38 2 2 0 0 1 3.58 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17.92z" />
      </svg>
      <div>
        <p className="text-[var(--color-text-primary)] font-semibold text-lg leading-snug">No emergency contacts</p>
        <p className="mt-1 text-[var(--color-text-secondary)] text-sm max-w-xs">
          Add emergency contacts so help is always just one tap away.
        </p>
      </div>
    </div>
  )
}

// ─── Tab 1: Care Team (Providers) ─────────────────────────────────────────────

function CareTeamTab() {
  const { providers, isLoading, addProvider, deleteProvider } = useProviders()
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState<ProviderSpecialty>('primary_care')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setName('')
    setSpecialty('primary_care')
    setPhone('')
    setEmail('')
    setAddress('')
    setNotes('')
  }

  const handleAdd = () => {
    if (!name.trim()) return
    addProvider({
      name: name.trim(),
      specialty,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    })
    resetForm()
    setShowForm(false)
  }

  return (
    <section aria-label="Care Team">
      <ul className="space-y-3 mb-6" role="list">
        {isLoading ? (
          <>
            <li><SkeletonCard lines={3} /></li>
            <li><SkeletonCard lines={3} /></li>
          </>
        ) : providers.length === 0 ? (
          <li role="listitem"><EmptyProviders /></li>
        ) : (
          providers.map((p: Provider) => (
            <li key={p.id} role="listitem">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-[var(--color-text-primary)] text-base leading-snug">
                        {p.name}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                          SPECIALTY_COLORS[p.specialty]
                        )}
                      >
                        {SPECIALTY_LABELS[p.specialty]}
                      </span>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      {p.phone && (
                        <a
                          href={`tel:${p.phone.replace(/\s/g, '')}`}
                          className="flex items-center gap-2 text-[var(--color-accent)] [font-size:var(--text-body)] font-medium hover:opacity-80 active:opacity-60 transition-opacity"
                          aria-label={`Call ${p.name} at ${p.phone}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 14 19.79 19.79 0 0 1 1.61 5.38 2 2 0 0 1 3.58 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17.92z" />
                          </svg>
                          {p.phone}
                        </a>
                      )}
                      {p.email && (
                        <a
                          href={`mailto:${p.email}`}
                          className="flex items-center gap-2 text-[var(--color-text-secondary)] [font-size:var(--text-label)] hover:text-[var(--color-text-primary)] active:opacity-60 transition-colors"
                          aria-label={`Email ${p.name} at ${p.email}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                          {p.email}
                        </a>
                      )}
                      {p.address && (
                        <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] leading-snug pl-0.5">
                          {p.address}
                        </p>
                      )}
                      {p.notes && (
                        <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] leading-relaxed italic">
                          {p.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <DeleteButton
                    label={`Remove ${p.name}`}
                    onClick={() => deleteProvider(p.id)}
                  />
                </div>
              </Card>
            </li>
          ))
        )}
      </ul>

      {/* Accordion add form */}
      {showForm ? (
        <div className="rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-bg-secondary)] p-5 mb-3 animate-view-in">
          <p className="font-bold text-[var(--color-text-primary)] mb-4 [font-size:var(--text-body)]">
            Add Provider
          </p>

          <FG label="Name" id="prov-name">
            <Input
              id="prov-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Jane Smith"
            />
          </FG>

          <FG label="Specialty" id="prov-specialty">
            <SelectInput id="prov-specialty" value={specialty} onChange={(v) => setSpecialty(v as ProviderSpecialty)}>
              <option value="primary_care">Primary Care</option>
              <option value="cardiologist">Cardiologist</option>
              <option value="pharmacist">Pharmacist</option>
              <option value="neurologist">Neurologist</option>
              <option value="specialist">Specialist</option>
              <option value="other">Other</option>
            </SelectInput>
          </FG>

          <div className="flex gap-2.5">
            <FG label="Phone" id="prov-phone">
              <Input
                id="prov-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
              />
            </FG>
            <FG label="Email" id="prov-email">
              <Input
                id="prov-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@clinic.com"
              />
            </FG>
          </div>

          <FG label="Address" id="prov-address">
            <Input
              id="prov-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Medical Center Dr, Suite 4"
            />
          </FG>

          <FG label="Notes" id="prov-notes">
            <textarea
              id="prov-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="fi w-full h-16 py-3 px-3.5 resize-none rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] text-[var(--color-text-primary)] [font-size:var(--text-body)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              rows={2}
              placeholder="Optional notes"
            />
          </FG>

          <div className="flex gap-2.5 mt-1">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => { resetForm(); setShowForm(false) }}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="md" className="flex-1" onClick={handleAdd} disabled={!name.trim()}>
              Add Provider
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setShowForm(true)}
          className="w-full mt-2 py-4 text-lg font-bold border-2 border-dashed border-[var(--color-border-primary)] text-[var(--color-text-secondary)] rounded-2xl flex items-center justify-center gap-2 min-h-[52px]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Provider
        </Button>
      )}
    </section>
  )
}

// ─── Tab 2: Caregivers ────────────────────────────────────────────────────────

function CaregiversTab() {
  const { connections, isLoading, addConnection, revokeConnection, deleteConnection, updateConnection } = useCareNetwork()
  const { canUseCaregiverMode } = useSubscription()
  const [showForm, setShowForm] = useState(false)

  const [cgName, setCgName] = useState('')
  const [cgEmail, setCgEmail] = useState('')
  const [cgRelationship, setCgRelationship] = useState<CareRelationship>('spouse')
  const [cgNotify, setCgNotify] = useState(true)

  const resetForm = () => {
    setCgName('')
    setCgEmail('')
    setCgRelationship('spouse')
    setCgNotify(true)
  }

  const handleInvite = () => {
    if (!cgName.trim() || !cgEmail.trim()) return
    addConnection({
      caregiver_name: cgName.trim(),
      caregiver_email: cgEmail.trim(),
      relationship: cgRelationship,
      notify_on_miss: cgNotify,
    })
    resetForm()
    setShowForm(false)
  }

  return (
    <section aria-label="Caregivers">
      <ul className="space-y-3 mb-6" role="list">
        {isLoading ? (
          <>
            <li><SkeletonCard lines={3} /></li>
            <li><SkeletonCard lines={3} /></li>
          </>
        ) : connections.length === 0 ? (
          <li role="listitem"><EmptyCaregivers /></li>
        ) : (
          connections.map((c: CareConnection) => {
            const isRevoked = c.status === 'revoked'
            return (
              <li key={c.id} role="listitem">
                <Card className={cn(isRevoked && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-[var(--color-text-primary)] text-base leading-snug">
                          {c.caregiver_name}
                        </span>
                        <span className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">
                          {RELATIONSHIP_LABELS[c.relationship]}
                        </span>
                      </div>
                      <p className="text-[var(--color-text-secondary)] [font-size:var(--text-label)] mb-2">
                        {c.caregiver_email}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            STATUS_STYLES[c.status]
                          )}
                        >
                          {c.status === 'pending' ? 'Pending' : c.status === 'accepted' ? 'Accepted' : 'Revoked'}
                        </span>

                        {c.status === 'pending' && (
                          <span className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] italic">
                            Waiting for acceptance...
                          </span>
                        )}
                      </div>

                      {/* Notify on missed dose toggle */}
                      <div className="flex items-center gap-2.5 mt-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={c.notify_on_miss}
                          disabled={isRevoked}
                          onClick={() => !isRevoked && updateConnection({ id: c.id, updates: { notify_on_miss: !c.notify_on_miss } })}
                          className={cn(
                            'relative w-10 h-[22px] rounded-full transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                            !isRevoked && 'cursor-pointer',
                            isRevoked && 'cursor-not-allowed',
                            c.notify_on_miss
                              ? 'bg-[var(--color-accent)]'
                              : 'bg-[var(--color-border-primary)]'
                          )}
                          aria-label="Notify on missed dose"
                        >
                          <span
                            className={cn(
                              'absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform',
                              c.notify_on_miss ? 'translate-x-[22px]' : 'translate-x-[3px]'
                            )}
                            aria-hidden
                          />
                        </button>
                        <span className="text-[var(--color-text-secondary)] [font-size:var(--text-label)]">
                          Notify on missed dose
                          {isRevoked && <span className="ml-1 text-[var(--color-text-tertiary)]">(locked)</span>}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      {c.status === 'accepted' && (
                        <button
                          type="button"
                          onClick={() => revokeConnection(c.id)}
                          className="text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] hover:opacity-80 active:scale-95 transition-transform"
                          aria-label={`Revoke access for ${c.caregiver_name}`}
                        >
                          Revoke
                        </button>
                      )}
                      <DeleteButton
                        label={`Remove ${c.caregiver_name}`}
                        onClick={() => deleteConnection(c.id)}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            )
          })
        )}
      </ul>

      {/* Accordion add form — gated behind Pro */}
      {!canUseCaregiverMode ? (
        <UpgradePrompt feature="Caregiver mode" requiredTier="pro" className="mt-1" />
      ) : showForm ? (
        <div className="rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-bg-secondary)] p-5 mb-3 animate-view-in">
          <p className="font-bold text-[var(--color-text-primary)] mb-4 [font-size:var(--text-body)]">
            Invite Caregiver
          </p>

          <div className="flex gap-2.5">
            <FG label="Name" id="cg-name">
              <Input
                id="cg-name"
                value={cgName}
                onChange={(e) => setCgName(e.target.value)}
                placeholder="Full name"
              />
            </FG>
            <FG label="Relationship" id="cg-rel">
              <SelectInput id="cg-rel" value={cgRelationship} onChange={(v) => setCgRelationship(v as CareRelationship)}>
                <option value="spouse">Spouse</option>
                <option value="parent">Parent</option>
                <option value="child">Child</option>
                <option value="friend">Friend</option>
                <option value="nurse">Nurse</option>
                <option value="other">Other</option>
              </SelectInput>
            </FG>
          </div>

          <FG label="Email" id="cg-email">
            <Input
              id="cg-email"
              type="email"
              value={cgEmail}
              onChange={(e) => setCgEmail(e.target.value)}
              placeholder="caregiver@example.com"
            />
          </FG>

          {/* Notify checkbox */}
          <label className="flex items-center gap-3 mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={cgNotify}
              onChange={(e) => setCgNotify(e.target.checked)}
              className="w-[18px] h-[18px] rounded accent-[var(--color-accent)] cursor-pointer"
            />
            <span className="text-[var(--color-text-primary)] [font-size:var(--text-body)]">
              Notify when I miss a dose
            </span>
          </label>

          <div className="flex gap-2.5">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => { resetForm(); setShowForm(false) }}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="md" className="flex-1" onClick={handleInvite} disabled={!cgName.trim() || !cgEmail.trim()}>
              Send Invite
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setShowForm(true)}
          className="w-full mt-2 py-4 text-lg font-bold border-2 border-dashed border-[var(--color-border-primary)] text-[var(--color-text-secondary)] rounded-2xl flex items-center justify-center gap-2 min-h-[52px]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Caregiver
        </Button>
      )}
    </section>
  )
}

// ─── Tab 3: Emergency ─────────────────────────────────────────────────────────

function EmergencyTab() {
  const { contacts, isLoading, addContact, removeContact } = useEmergencyContacts()
  const [showForm, setShowForm] = useState(false)

  const [ecName, setEcName] = useState('')
  const [ecRel, setEcRel] = useState('')
  const [ecPhone, setEcPhone] = useState('')

  const resetForm = () => {
    setEcName('')
    setEcRel('')
    setEcPhone('')
  }

  const handleAdd = () => {
    if (!ecName.trim() || !ecPhone.trim()) return
    addContact({
      name: ecName.trim(),
      relationship: ecRel.trim(),
      phone: ecPhone.trim(),
      notes: null,
    })
    resetForm()
    setShowForm(false)
  }

  return (
    <section aria-label="Emergency contacts">
      <div className="mb-6 flex items-start gap-3 rounded-2xl p-4 bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)] border border-[color-mix(in_srgb,var(--color-red)_20%,transparent)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-[var(--color-red)] [font-size:var(--text-body)] font-bold leading-relaxed" role="alert">
          These contacts are for your personal reference only. In an emergency, always call 911.
        </p>
      </div>

      <ul className="space-y-3 mb-6" role="list">
        {isLoading ? (
          <>
            <li><SkeletonCard lines={2} /></li>
            <li><SkeletonCard lines={2} /></li>
          </>
        ) : contacts.length === 0 ? (
          <li role="listitem"><EmptyEmergency /></li>
        ) : (
          contacts.map((c: EmergencyContact) => (
            <li key={c.id} role="listitem">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-[var(--color-text-primary)] text-base leading-snug">
                        {c.name}
                      </span>
                      {c.relationship && (
                        <span className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">
                          {c.relationship}
                        </span>
                      )}
                    </div>

                    <a
                      href={`tel:${c.phone.replace(/\s/g, '')}`}
                      aria-label={`Call ${c.name} at ${c.phone}`}
                      className="inline-flex items-center gap-2.5 mt-1.5 px-4 py-2.5 rounded-xl font-bold text-white bg-[var(--color-red)] hover:opacity-90 active:scale-95 transition-all outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] [font-size:var(--text-body)]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 14 19.79 19.79 0 0 1 1.61 5.38 2 2 0 0 1 3.58 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17.92z" />
                      </svg>
                      {c.phone}
                    </a>
                  </div>

                  <DeleteButton
                    label={`Remove ${c.name}`}
                    onClick={() => removeContact(c.id)}
                  />
                </div>
              </Card>
            </li>
          ))
        )}
      </ul>

      {/* Accordion add form */}
      {showForm ? (
        <div className="rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-bg-secondary)] p-5 mb-3 animate-view-in">
          <p className="font-bold text-[var(--color-text-primary)] mb-4 [font-size:var(--text-body)]">
            Add Emergency Contact
          </p>

          <div className="flex gap-2.5">
            <FG label="Name" id="ec-name">
              <Input
                id="ec-name"
                value={ecName}
                onChange={(e) => setEcName(e.target.value)}
                placeholder="Full name"
              />
            </FG>
            <FG label="Relationship" id="ec-rel">
              <Input
                id="ec-rel"
                value={ecRel}
                onChange={(e) => setEcRel(e.target.value)}
                placeholder="e.g. Spouse"
              />
            </FG>
          </div>

          <FG label="Phone" id="ec-phone">
            <Input
              id="ec-phone"
              type="tel"
              value={ecPhone}
              onChange={(e) => setEcPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </FG>

          <div className="flex gap-2.5 mt-1">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => { resetForm(); setShowForm(false) }}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="md" className="flex-1" onClick={handleAdd} disabled={!ecName.trim() || !ecPhone.trim()}>
              Add Contact
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setShowForm(true)}
          className="w-full mt-2 py-4 text-lg font-bold border-2 border-dashed border-[var(--color-border-primary)] text-[var(--color-text-secondary)] rounded-2xl flex items-center justify-center gap-2 min-h-[52px]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Contact
        </Button>
      )}
    </section>
  )
}

// ─── Main: CareView ───────────────────────────────────────────────────────────

type CareTab = 'team' | 'caregivers' | 'emergency'

const CARE_TABS: { id: CareTab; label: string }[] = [
  { id: 'team', label: 'Care Team' },
  { id: 'caregivers', label: 'Caregivers' },
  { id: 'emergency', label: 'Emergency' },
]

export function CareView() {
  const [activeTab, setActiveTab] = useState<CareTab>('team')

  return (
    <div className="animate-view-in w-full max-w-[480px] mx-auto">
      <h2 className="page-header text-xl sm:[font-size:var(--text-title)]">
        Care Coordination
      </h2>

      {/* Tab bar — sticky within view */}
      <div
        role="tablist"
        aria-label="Care coordination sections"
        className="sticky top-[calc(var(--header-height,80px)+1rem)] z-10 tab-bar mb-6 backdrop-blur-sm"
      >
        {CARE_TABS.map((t) => {
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              id={`care-tab-${t.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`care-panel-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'tab-item outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
                isActive && 'tab-item-active'
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      <div
        id={`care-panel-team`}
        role="tabpanel"
        aria-labelledby="care-tab-team"
        hidden={activeTab !== 'team'}
      >
        {activeTab === 'team' && <CareTeamTab />}
      </div>

      <div
        id={`care-panel-caregivers`}
        role="tabpanel"
        aria-labelledby="care-tab-caregivers"
        hidden={activeTab !== 'caregivers'}
      >
        {activeTab === 'caregivers' && <CaregiversTab />}
      </div>

      <div
        id={`care-panel-emergency`}
        role="tabpanel"
        aria-labelledby="care-tab-emergency"
        hidden={activeTab !== 'emergency'}
      >
        {activeTab === 'emergency' && <EmergencyTab />}
      </div>
    </div>
  )
}

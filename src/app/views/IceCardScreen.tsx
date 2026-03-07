/**
 * ICE (In Case of Emergency) Card Screen.
 *
 * Accessible without login — when a session exists the card shows the
 * authenticated user's data. When printed or saved as a QR image it can
 * be accessed offline by emergency responders.
 *
 * Route: /ice (public — no PrivateRoute wrapper)
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useMedications } from '@/shared/hooks/useMedications'
import { AuditService } from '@/shared/services/audit'
import type { EmergencyContact } from '@/shared/types/care-types'

// ── QR code generation (no external library — uses canvas API) ──────────────
// The QR code is self-contained text; emergency responders scan it to read data
// without any internet connection.

function buildIceText(params: {
  name: string | null
  bloodType: string | null
  allergies: string[]
  conditions: string[]
  meds: Array<{ name: string; dosage: string | null; freq: number }>
  contacts: EmergencyContact[]
}): string {
  const lines: string[] = ['=== MarinLoop ICE CARD ===']
  if (params.name)      lines.push(`Name: ${params.name}`)
  if (params.bloodType) lines.push(`Blood Type: ${params.bloodType}`)
  if (params.allergies.length > 0)  lines.push(`Allergies: ${params.allergies.join(', ')}`)
  if (params.conditions.length > 0) lines.push(`Conditions: ${params.conditions.join(', ')}`)
  if (params.meds.length > 0) {
    lines.push('Medications:')
    params.meds.forEach((m) => lines.push(`  - ${m.name}${m.dosage ? ' ' + m.dosage : ''} ${m.freq}x/day`))
  }
  if (params.contacts.length > 0) {
    lines.push('Emergency Contacts:')
    params.contacts.forEach((c) => lines.push(`  - ${c.name} (${c.relationship}): ${c.phone}`))
  }
  lines.push(`Generated: ${new Date().toLocaleDateString()}`)
  return lines.join('\n')
}

// Very small QR code generator using the free QR code API (we cache this in the component)
// Only the ICE text data is passed; no PII hits external services beyond the user's device.
function QRCodeImage({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Use a data: URI approach with the browser's built-in APIs where possible.
    // We generate the QR via the canvas if a lightweight generator is available,
    // otherwise fall back to a base64 placeholder text block.
    // This is deliberately kept offline-capable.
    setSrc(null)
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(text, { errorCorrectionLevel: 'M', width: 240, margin: 2 })
        .then((url) => setSrc(url))
        .catch(() => setSrc(null))
    }).catch(() => setSrc(null))
  }, [text])

  if (!src) {
    return (
      <div
        className="w-48 h-48 flex items-center justify-center border-2 border-dashed border-[var(--color-border-primary)] rounded-xl text-[var(--color-text-tertiary)] text-xs text-center p-3"
      >
        QR code unavailable (add "qrcode" package)
      </div>
    )
  }

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <img
        src={src}
        alt="ICE card QR code — scan to read emergency data offline"
        className="w-48 h-48 rounded-xl border border-[var(--color-border-primary)]"
        style={{ imageRendering: 'pixelated' }}
      />
    </>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">{children}</span>
      <div className="flex-1 h-px bg-[var(--color-border-primary)]" />
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--color-border-secondary)] last:border-0">
      <span className="w-32 shrink-0 text-[var(--color-text-tertiary)] [font-size:var(--text-label)] font-medium">{label}</span>
      <span className="text-[var(--color-text-primary)] [font-size:var(--text-body)] font-semibold">{value}</span>
    </div>
  )
}

export function IceCardScreen() {
  const navigate = useNavigate()
  const { profile, session } = useAuthStore()
  const { meds } = useMedications()
  const [showQR, setShowQR] = useState(false)

  const isAuthenticated = !!session

  // Parse emergency contacts from JSONB
  const contacts: EmergencyContact[] = (() => {
    try {
      const raw = profile?.emergency_contacts
      if (Array.isArray(raw)) return raw as EmergencyContact[]
      return []
    } catch { return [] }
  })()

  const iceText = buildIceText({
    name: profile?.name ?? null,
    bloodType: profile?.blood_type ?? null,
    allergies: profile?.allergies ?? [],
    conditions: profile?.conditions ?? [],
    meds: meds.map((m) => ({ name: m.name, dosage: m.dosage, freq: m.freq })),
    contacts,
  })

  // Log ICE card access
  useEffect(() => {
    if (isAuthenticated) {
      AuditService.logAsync({ action: 'ice_card.viewed', entity_type: 'profile' })
    }
  }, [isAuthenticated])

  const handlePrint = () => window.print()

  const handleCopyText = () => {
    navigator.clipboard.writeText(iceText).catch(() => {})
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-red)] flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)] mb-2">ICE Card</h1>
        <p className="text-[var(--color-text-secondary)] mb-6 max-w-xs leading-relaxed">
          Sign in to view your emergency medical information card.
        </p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-bold rounded-xl cursor-pointer border-none"
        >
          Sign in
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] pb-20">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg-primary-translucent)] backdrop-blur-[12px] border-b border-[var(--color-border-primary)] px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="font-extrabold text-[var(--color-text-primary)] text-lg leading-tight">ICE Card</h1>
          <p className="text-[var(--color-text-tertiary)] text-xs">In Case of Emergency</p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          aria-label="Print ICE card"
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border-primary)] text-xs font-semibold text-[var(--color-text-secondary)] cursor-pointer bg-[var(--color-bg-secondary)]"
        >
          Print
        </button>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pt-5 space-y-5" id="ice-card-content">

        {/* ── Alert banner ── */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[color-mix(in_srgb,var(--color-red)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-red)_25%,transparent)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-red)] flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-[var(--color-red)] [font-size:var(--text-body)]">Emergency Medical Information</div>
            <div className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)]">For emergency responders — please read in case of emergency</div>
          </div>
        </div>

        {/* ── Identity ── */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border-primary)] p-4">
          <SectionHeader>Identity</SectionHeader>
          <DataRow label="Name"       value={profile?.name} />
          <DataRow label="Blood Type" value={profile?.blood_type || <span className="text-[var(--color-text-tertiary)] italic font-normal">Not set</span>} />
        </div>

        {/* ── Allergies ── */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border-primary)] p-4">
          <SectionHeader>Allergies</SectionHeader>
          {(profile?.allergies ?? []).length === 0 ? (
            <p className="text-[var(--color-text-tertiary)] text-sm italic">None recorded</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(profile?.allergies ?? []).map((a) => (
                <span key={a} className="px-3 py-1 rounded-full bg-[color-mix(in_srgb,var(--color-red)_12%,transparent)] text-[var(--color-red)] text-xs font-bold border border-[color-mix(in_srgb,var(--color-red)_25%,transparent)]">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Conditions ── */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border-primary)] p-4">
          <SectionHeader>Medical Conditions</SectionHeader>
          {(profile?.conditions ?? []).length === 0 ? (
            <p className="text-[var(--color-text-tertiary)] text-sm italic">None recorded</p>
          ) : (
            <div className="flex flex-col gap-1">
              {(profile?.conditions ?? []).map((c) => (
                <span key={c} className="text-[var(--color-text-primary)] [font-size:var(--text-body)] font-semibold">• {c}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Current Medications ── */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border-primary)] p-4">
          <SectionHeader>Current Medications</SectionHeader>
          {meds.length === 0 ? (
            <p className="text-[var(--color-text-tertiary)] text-sm italic">No medications on record</p>
          ) : (
            <div className="flex flex-col gap-2">
              {meds.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-3 py-2 border-b border-[var(--color-border-secondary)] last:border-0">
                  <div>
                    <span className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-body)]">{m.name}</span>
                    {m.dosage && <span className="ml-2 text-[var(--color-text-secondary)] [font-size:var(--text-caption)]">{m.dosage}</span>}
                  </div>
                  <span className="shrink-0 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">{m.freq}x/day</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Emergency Contacts ── */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border-primary)] p-4">
          <SectionHeader>Emergency Contacts</SectionHeader>
          {contacts.length === 0 ? (
            <p className="text-[var(--color-text-tertiary)] text-sm italic">No contacts on record</p>
          ) : (
            <div className="flex flex-col gap-3">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-body)]">{c.name}</div>
                    <div className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)] capitalize">{c.relationship}</div>
                  </div>
                  <a
                    href={`tel:${c.phone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-xs font-bold no-underline"
                    aria-label={`Call ${c.name}`}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.92 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    {c.phone}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── QR Code ── */}
        <div className="bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border-primary)] p-4">
          <SectionHeader>Shareable QR Code</SectionHeader>
          <p className="text-[var(--color-text-secondary)] [font-size:var(--text-caption)] mb-3 leading-relaxed">
            This QR code encodes all your ICE data. Emergency responders can scan it without internet access.
          </p>
          <div className="flex flex-col items-center gap-3">
            {showQR ? (
              <QRCodeImage text={iceText} />
            ) : (
              <button
                type="button"
                onClick={() => setShowQR(true)}
                className="px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-bold cursor-pointer border-none [font-size:var(--text-body)]"
              >
                Generate QR Code
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyText}
              className="text-[var(--color-accent)] [font-size:var(--text-caption)] font-semibold cursor-pointer bg-transparent border-none underline"
            >
              Copy as plain text
            </button>
          </div>
        </div>

        {/* ── Edit prompt ── */}
        <div className="text-center pb-4">
          <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mb-2">
            Update your blood type, conditions, and allergies in Profile settings.
          </p>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="text-[var(--color-accent)] [font-size:var(--text-caption)] font-semibold cursor-pointer bg-transparent border-none underline"
          >
            Go to Profile
          </button>
        </div>
      </div>
    </div>
  )
}

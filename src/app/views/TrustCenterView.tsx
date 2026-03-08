import { useNavigate } from 'react-router-dom'

export function TrustCenterView() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg-primary)] py-8">
      <div className="mx-auto w-full max-w-2xl px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 flex cursor-pointer items-center gap-2 border-none bg-transparent font-semibold text-[var(--color-text-secondary)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] [font-size:var(--text-body)]"
          aria-label="Go back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back
        </button>

        <div className="mb-8 rounded-[28px] border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-6 shadow-[var(--shadow-elevated)]">
          <p className="mb-2 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">MarinLoop trust center</p>
          <h1 className="mb-3 font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)] [font-size:var(--text-title)]">
            Clinical boundary, data posture, and reviewer guidance
          </h1>
          <p className="max-w-[60ch] text-[var(--color-text-secondary)] [font-size:var(--text-body)]">
            MarinLoop is a personal medication tracking and reminder product for patients and caregivers. It is deliberately scoped below clinical decision-making and below covered-entity deployment in this beta.
          </p>
        </div>

        <div className="space-y-6 text-[var(--color-text-secondary)] [font-size:var(--text-body)] leading-relaxed">
          <section className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5">
            <h2 className="mb-2 font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)]">Intended use</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Personal medication schedules, refill timing, adherence history, and reminders</li>
              <li>Patient and caregiver coordination around daily routines</li>
              <li>Informational drug reference lookups and optional AI-assisted organization</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5">
            <h2 className="mb-2 font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)]">Not intended for</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Diagnosis, treatment, or clinician-directed decision support</li>
              <li>Emergency alerting or any safety-critical workflow where missed notifications would create unacceptable risk</li>
              <li>Provider-deployed or covered-entity workflows that require HIPAA business associate agreements in this beta</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5">
            <h2 className="mb-2 font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)]">AI and privacy boundary</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>AI features are optional and require explicit consent</li>
              <li>Core medication tracking works without AI</li>
              <li>This beta does not offer AI under the BAAs required for HIPAA-regulated workflows</li>
              <li>Do not use regulated PHI, real patient identifiers, MRNs, or Social Security numbers in AI flows</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5">
            <h2 className="mb-2 font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)]">Current safeguards</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Supabase Auth and Row Level Security</li>
              <li>Server-side AI calls through Edge Functions</li>
              <li>In-app terms, privacy policy, and revocable AI consent</li>
              <li>Account export and deletion controls</li>
              <li>Idle timeout support and audit-minded data handling patterns</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5">
            <h2 className="mb-2 font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)]">For reviewers</h2>
            <p>
              If you are a clinician, technical partner, or investor, the key point is scope discipline: MarinLoop is intentionally presented as a patient-facing workflow tool with explicit limits, not as a clinical system making treatment decisions.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">
              <button type="button" onClick={() => navigate('/terms')} className="cursor-pointer border-none bg-transparent p-0 text-inherit underline underline-offset-4">
                Terms
              </button>
              <button type="button" onClick={() => navigate('/privacy')} className="cursor-pointer border-none bg-transparent p-0 text-inherit underline underline-offset-4">
                Privacy
              </button>
              <a href="https://www.fda.gov/medical-devices/digital-health-center-excellence/device-software-functions-including-mobile-medical-applications" className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                FDA guidance
              </a>
              <a href="https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html" className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                HHS HIPAA cloud guidance
              </a>
            </div>
          </section>
        </div>

        <p className="mt-10 text-center text-[var(--color-text-tertiary)] [font-size:var(--text-caption)]">
          MarinLoop provides reminders, tracking, and informational reference tools. Not medical advice. In a medical emergency, call 911 or your local emergency number.
        </p>
      </div>
    </div>
  )
}

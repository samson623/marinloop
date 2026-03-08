import { useNavigate } from 'react-router-dom'

export function PrivacyPolicyView() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] px-4 py-8 max-w-[680px] mx-auto">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 mb-6 text-[var(--color-text-secondary)] border-none bg-transparent cursor-pointer [font-size:var(--text-body)] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        aria-label="Go back"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Back
      </button>

      <h1 className="font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)] [font-size:var(--text-title)] mb-2">Privacy Policy</h1>
      <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mb-8">Effective: March 2026 &mdash; MarinLoop beta</p>

      <div className="prose prose-sm max-w-none space-y-6 text-[var(--color-text-secondary)] [font-size:var(--text-body)] leading-relaxed">

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">1. Overview</h2>
          <p>
            MarinLoop (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is a medication management and health tracking application. We take your privacy seriously. This policy explains what information we collect, how we use it, and your rights regarding your data.
          </p>
          <p className="mt-2">
            <strong className="text-[var(--color-text-primary)]">MarinLoop is not a medical device and this beta is not offered as a HIPAA-regulated deployment for covered-entity workflows.</strong> Do not use it to store third-party PHI, patient MRN numbers, Social Security numbers, or other regulated identifiers for production clinical use.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">2. Information We Collect</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-[var(--color-text-primary)]">Account data:</strong> email address, name, and authentication credentials.</li>
            <li><strong className="text-[var(--color-text-primary)]">Health data:</strong> medications, schedules, dose logs, appointments, notes, vitals, journal entries, symptoms, and reminders that you enter.</li>
            <li><strong className="text-[var(--color-text-primary)]">Device data:</strong> push notification subscription tokens, browser/platform type, and timezone.</li>
            <li><strong className="text-[var(--color-text-primary)]">Usage data:</strong> feature interactions and AI feature usage counts for rate-limiting.</li>
            <li><strong className="text-[var(--color-text-primary)]">Error data:</strong> crash reports and error traces (no health data is included in error reports).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">3. Third-Party Services</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">Supabase (Database &amp; Authentication)</h3>
              <p>Your health data and account credentials are stored in Supabase, a cloud database provider. Data is encrypted at rest and in transit. Supabase is our primary data processor. See <a href="https://supabase.com/privacy" className="underline text-[var(--color-accent)]" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>.</p>
            </div>

            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">OpenAI (AI Features — Optional)</h3>
              <p>If you consent to AI features, medication names, dosages, schedules, notes, and images of prescription labels may be sent to OpenAI&apos;s API for processing (insights, label extraction, voice commands). MarinLoop beta is not offering these AI features under the business associate agreements required for HIPAA-regulated workflows, so do not include regulated PHI, real patient names, MRN numbers, or Social Security numbers. See <a href="https://openai.com/privacy" className="underline text-[var(--color-accent)]" target="_blank" rel="noopener noreferrer">openai.com/privacy</a>. You can revoke AI consent at any time in Profile &rarr; Data &amp; Privacy.</p>
            </div>

            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">Sentry (Error Monitoring)</h3>
              <p>Application errors and performance issues are reported to Sentry. Error reports include stack traces and browser metadata. No health data or personally identifiable information is intentionally included in error reports. See <a href="https://sentry.io/privacy/" className="underline text-[var(--color-accent)]" target="_blank" rel="noopener noreferrer">sentry.io/privacy</a>.</p>
            </div>

            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">NIH RxNav &amp; OpenFDA (Drug Information)</h3>
              <p>Drug information lookups (interaction checks, label data) are made <strong className="text-[var(--color-text-primary)]">directly from your device</strong> to the NIH RxNav and OpenFDA APIs. As part of these requests, NIH and FDA servers may receive your IP address and browser metadata alongside the medication names and drug codes (NDC/RxCUI) being queried. MarinLoop does not transmit your user account identifiers in these requests. These services are operated by the U.S. government and are subject to their own privacy policies: <a href="https://www.nih.gov/web-policies-notices" className="underline text-[var(--color-accent)]" target="_blank" rel="noopener noreferrer">NIH Web Policies</a> and <a href="https://open.fda.gov/privacy/" className="underline text-[var(--color-accent)]" target="_blank" rel="noopener noreferrer">openFDA Privacy</a>.</p>
            </div>

            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">Vercel (Hosting)</h3>
              <p>The MarinLoop web application is hosted on Vercel. Vercel may log request metadata (IP address, user-agent) for security and operational purposes. See <a href="https://vercel.com/legal/privacy-policy" className="underline text-[var(--color-accent)]" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a>.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">4. How We Use Your Data</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>To provide medication tracking, scheduling, reminders, and adherence insights.</li>
            <li>To deliver push notifications for dose reminders and alerts.</li>
            <li>To power optional AI features (with your explicit consent).</li>
            <li>To detect and fix software errors.</li>
            <li>To enforce beta usage limits and prevent abuse.</li>
          </ul>
          <p className="mt-2">We do not sell your personal data. We do not use your health data for advertising.</p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">5. Data Retention</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Notifications are automatically deleted after 180 days.</li>
            <li>Notification dispatch logs are automatically deleted after 90 days.</li>
            <li>All other health data is retained until you delete your account.</li>
            <li>Beta data may be reset prior to general availability with advance notice.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">6. Your Rights</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-[var(--color-text-primary)]">Export:</strong> Download all your health data as JSON from Profile &rarr; Account Actions.</li>
            <li><strong className="text-[var(--color-text-primary)]">Deletion:</strong> Delete all health data instantly from Profile &rarr; Account Actions &rarr; Delete My Account &amp; Data.</li>
            <li><strong className="text-[var(--color-text-primary)]">AI opt-out:</strong> Revoke AI consent at any time from Profile &rarr; Data &amp; Privacy. This stops future AI processing but does not retroactively delete data previously sent to OpenAI.</li>
            <li><strong className="text-[var(--color-text-primary)]">Credential removal:</strong> Login credentials (email/password) are removed within 30 days of account deletion. For immediate removal, email <a href="mailto:admin@marinloop.com" className="underline text-[var(--color-accent)]">admin@marinloop.com</a>.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">7. Security</h2>
          <p>
            We use industry-standard security practices: HTTPS-only transport, database encryption at rest, Row Level Security (RLS) policies ensuring you can only access your own data, and PKCE-based OAuth for authentication. We do not store passwords in plaintext.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">8. Children</h2>
          <p>
            MarinLoop is not directed at children under 13 years of age. We do not knowingly collect data from children under 13.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy as MarinLoop evolves. Material changes will be communicated via in-app notice or email. Continued use after notice constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">10. Contact</h2>
          <p>
            Privacy questions or requests: <a href="mailto:admin@marinloop.com" className="underline text-[var(--color-accent)]">admin@marinloop.com</a>
          </p>
        </section>
      </div>

      <p className="mt-10 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] text-center">
        MarinLoop provides reminders and tracking tools. Not medical advice. Always follow your healthcare provider&apos;s instructions.
      </p>
    </div>
  )
}

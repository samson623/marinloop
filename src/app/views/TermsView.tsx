import { useNavigate } from 'react-router-dom'

export function TermsView() {
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

      <h1 className="font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)] [font-size:var(--text-title)] mb-2">Terms of Service</h1>
      <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mb-8">Effective: March 2026 &mdash; marinloop beta</p>

      <div className="space-y-6 text-[var(--color-text-secondary)] [font-size:var(--text-body)] leading-relaxed">

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">1. Acceptance of Terms</h2>
          <p>
            By accessing or using marinloop (&ldquo;the App&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">2. Beta Software Disclaimer</h2>
          <p>
            marinloop is currently in <strong className="text-[var(--color-text-primary)]">pre-release beta</strong>. The App is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; Features may change, data may be reset, and the service may experience downtime without notice. Beta access may be revoked at any time.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">3. Not Medical Advice</h2>
          <p>
            <strong className="text-[var(--color-text-primary)]">marinloop is not a medical device, clinical decision support tool, or substitute for professional medical advice.</strong> The App provides reminders, tracking, and informational tools only. Nothing in marinloop constitutes medical advice, diagnosis, or treatment recommendations.
          </p>
          <p className="mt-2">
            Always follow the instructions of your licensed healthcare provider regarding medications, dosages, and health decisions. In a medical emergency, call 911 or your local emergency number immediately.
          </p>
          <p className="mt-2">
            Push notification delivery is not guaranteed. Do not rely solely on marinloop reminders for critical medication adherence. marinloop is not responsible for missed doses resulting from notification failure.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">4. Eligibility</h2>
          <p>
            You must be 13 years of age or older to use marinloop. By using the App, you represent that you meet this requirement. Beta access requires a valid invite code.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">5. Account Responsibilities</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must provide accurate information when creating your account.</li>
            <li>You must not share your beta invite code publicly or with unauthorized persons.</li>
            <li>You must not use the App to store or transmit protected health information (PHI) of others without appropriate legal authorization.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2">
            <li>Use the App for any unlawful purpose or in violation of applicable laws.</li>
            <li>Attempt to reverse-engineer, decompile, or circumvent security measures.</li>
            <li>Use the App to provide clinical services to third parties without appropriate licensure and agreements.</li>
            <li>Submit abusive, harassing, or harmful content through any feedback or notes features.</li>
            <li>Attempt to access other users&apos; data or circumvent Row Level Security policies.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">7. AI Features</h2>
          <p>
            AI-powered features (adherence insights, medication label extraction, voice commands) are optional and require your explicit consent. AI features are powered by OpenAI&apos;s API. By enabling AI features, you acknowledge that relevant medication data may be processed by OpenAI, which is not a HIPAA Business Associate.
          </p>
          <p className="mt-2">
            AI-generated content is informational only and is not medical advice. Always verify AI suggestions with a qualified healthcare provider.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">8. Intellectual Property</h2>
          <p>
            marinloop and its underlying technology, design, and content are owned by the marinloop team. You retain ownership of all personal health data you enter. By using the App, you grant us a limited license to process your data solely to provide the service as described in our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">9. Limitation of Liability</h2>
          <p>
            <strong className="text-[var(--color-text-primary)]">To the maximum extent permitted by law, marinloop and its operators are not liable for any indirect, incidental, special, consequential, or punitive damages</strong>, including but not limited to health outcomes resulting from reliance on App features, missed medication reminders, data loss, or service interruptions.
          </p>
          <p className="mt-2">
            Our total aggregate liability to you for any claims arising from use of the App shall not exceed the amount you paid for the App in the preceding 12 months (which, during beta, is zero).
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">10. Termination</h2>
          <p>
            We may suspend or terminate your access at any time for violation of these Terms or for any other reason at our discretion. You may delete your account at any time from Profile &rarr; Account Actions. Upon termination, your health data will be removed from active storage per our data retention policy.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">11. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the United States and the State of California, without regard to conflict of law principles. Any disputes shall be resolved through good-faith negotiation before pursuing legal remedies.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">12. Changes to These Terms</h2>
          <p>
            We may update these Terms as the App evolves. We will notify you of material changes via in-app notice or email. Continued use of the App after such notice constitutes your acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)] mb-2">13. Contact</h2>
          <p>
            Questions about these Terms: <a href="mailto:admin@marinloop.com" className="underline text-[var(--color-accent)]">admin@marinloop.com</a>
          </p>
        </section>
      </div>

      <p className="mt-10 text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] text-center">
        marinloop provides reminders and tracking tools. Not medical advice. Always follow your healthcare provider&apos;s instructions.
      </p>
    </div>
  )
}

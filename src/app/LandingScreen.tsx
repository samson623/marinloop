import { Navigate, useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useAuthStore } from '@/shared/stores/auth-store'
import { IconButton } from '@/shared/components/IconButton'
import { Button } from '@/shared/components/ui'
import {
  LogoIcon, SunIcon, MoonIcon, XIcon, CalendarIcon, CheckIcon,
  ClockIcon, BellIcon, PillIcon, BarChartIcon, UsersIcon, MicIcon,
} from '@/shared/components/icons'
import { useState, useEffect, useCallback, useRef } from 'react'
import '@/styles/landing.css'

// ---------------------------------------------------------------------------
// Hamburger SVG (no MenuIcon in icons.tsx)
// ---------------------------------------------------------------------------
function HamburgerSvg() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Nav links config
// ---------------------------------------------------------------------------
const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#trust', label: 'Trust' },
] as const

// ---------------------------------------------------------------------------
// DISCLAIMER (single source of truth — hero + footer)
// ---------------------------------------------------------------------------
const DISCLAIMER =
  'MarinLoop is a personal tracking and reminder product. It is not a medical device, not for emergency use, and not offered in this beta for covered-entity workflows requiring HIPAA business associate agreements.'

// ---------------------------------------------------------------------------
// useScrollReveal — IntersectionObserver, fires once, respects reduced-motion
// ---------------------------------------------------------------------------
function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(prefersReducedMotion)

  useEffect(() => {
    if (visible) return // already visible (reduced-motion or previously triggered)
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  return { ref, visible }
}

// ---------------------------------------------------------------------------
// Features data
// ---------------------------------------------------------------------------
const FEATURES = [
  { icon: ClockIcon, title: 'Daily Timeline', desc: 'Visual schedule of every dose — past, present, and upcoming — color-coded by status.' },
  { icon: BellIcon, title: 'Push Reminders', desc: 'Native push notifications that fire at the exact scheduled time, even when the app is closed.' },
  { icon: PillIcon, title: 'Medication Management', desc: 'Add medications by name or barcode. Track dosage, frequency, supply, and refill dates.' },
  { icon: BarChartIcon, title: 'Health Tracking', desc: 'Log vitals, journal entries, and view adherence trends over time in one place.' },
  { icon: UsersIcon, title: 'Care Network', desc: 'Share your care plan with providers, caregivers, and emergency contacts.' },
  { icon: MicIcon, title: 'AI Assistant', desc: 'Optional, informational tools only. Voice commands and label extraction — opt-in, revocable.' },
] as const

// ---------------------------------------------------------------------------
// FeatureCard — inline, unexported
// ---------------------------------------------------------------------------
function FeatureCard({ icon: Icon, title, desc, stagger, visible }: {
  icon: typeof ClockIcon
  title: string
  desc: string
  stagger: number
  visible: boolean
}) {
  return (
    <div className={`landing-feature-card landing-reveal landing-stagger-${stagger}${visible ? ' landing-reveal--visible' : ''}`}>
      <div className="landing-feature-card__icon">
        <Icon size={22} strokeWidth={2} aria-hidden="true" />
      </div>
      <h3 className="landing-feature-card__title">{title}</h3>
      <p className="landing-feature-card__desc">{desc}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// How It Works data
// ---------------------------------------------------------------------------
const STEPS = [
  { num: 1, title: 'Add Medications', desc: 'Search by name, scan a barcode, or enter manually. Set dosage, frequency, and times.' },
  { num: 2, title: 'Set Reminders', desc: 'Enable push notifications for each dose. MarinLoop fires them on schedule — even offline.' },
  { num: 3, title: 'Track Adherence', desc: 'Mark doses done, late, or missed. View daily rings and weekly trends at a glance.' },
] as const

// ---------------------------------------------------------------------------
// Product Preview — phone mockup data
// ---------------------------------------------------------------------------
const MOCK_TABS = [
  { id: 'timeline', label: 'Timeline', icon: ClockIcon },
  { id: 'meds', label: 'Meds', icon: PillIcon },
  { id: 'appts', label: 'Appts', icon: CalendarIcon },
  { id: 'health', label: 'Health', icon: BarChartIcon },
  { id: 'care', label: 'Care', icon: UsersIcon },
] as const

const MOCK_MEDS = [
  { name: 'Metformin 500mg', time: '8:00 AM', status: 'Done', color: 'var(--color-green)', bgClass: '', opacity: 0.55 },
  { name: 'Lisinopril 10mg', time: '12:00 PM', status: 'Late', color: 'var(--color-amber)', bgClass: '', opacity: 0.6 },
  { name: 'Vitamin D3', time: '6:00 PM', status: 'Next', color: 'var(--color-amber)', bgClass: 'bg-[var(--color-amber-bg)]', opacity: 1 },
  { name: 'Aspirin 81mg', time: '9:00 PM', status: 'Pending', color: 'var(--color-text-tertiary)', bgClass: '', opacity: 1 },
  { name: 'Probiotic', time: '7:00 AM', status: 'Missed', color: 'var(--color-red)', bgClass: 'bg-[var(--color-red-bg)]', opacity: 1 },
] as const

// Adherence ring math: 75% of circumference for r=46
const RING_CIRC = 2 * Math.PI * 46
const RING_OFFSET = RING_CIRC * (1 - 0.75)

// ---------------------------------------------------------------------------
// ProductPreview — inline, unexported
// ---------------------------------------------------------------------------
function ProductPreview() {
  const [activeTab, setActiveTab] = useState('timeline')

  return (
    <section
      id="preview"
      className="landing-section"
      aria-labelledby="preview-heading"
    >
      <h2 id="preview-heading" className="landing-section__heading">See It in Action</h2>
      <div className="landing-preview-wrapper">
        <div
          className="landing-phone-frame"
          role="img"
          aria-label="MarinLoop app preview showing a daily medication timeline with adherence tracking, five sample medications in various statuses, and bottom navigation tabs"
        >
          {/* Phone header */}
          <div className="landing-phone-header">
            <div className="landing-phone-header__logo">
              <LogoIcon size={16} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <span className="landing-phone-header__text">MarinLoop</span>
            <span className="landing-phone-header__badge">BETA</span>
          </div>

          {/* Phone content */}
          <div className="landing-phone-content">
            {/* Date header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div style={{ fontSize: 'var(--text-label)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Today
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                  Wednesday
                </div>
              </div>

              {/* Adherence ring */}
              <div className="text-center shrink-0">
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 100 100"
                  role="img"
                  aria-label="Adherence: 75%"
                >
                  <title>75% adherence today</title>
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    className="landing-ring-track"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    className="landing-ring-progress"
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={RING_OFFSET}
                  />
                </svg>
                <div style={{
                  fontSize: 'var(--text-subtitle)',
                  fontWeight: 800,
                  marginTop: -58,
                  position: 'relative',
                  zIndex: 1,
                  color: 'var(--color-text-primary)',
                }}>
                  75%
                </div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Adherence
                </div>
              </div>
            </div>

            {/* Status pills */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ fontSize: '10px', fontWeight: 600, background: 'var(--color-green-bg)', color: 'var(--color-green)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-green)' }} aria-hidden="true" />
                3 Done
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ fontSize: '10px', fontWeight: 600, background: 'var(--color-amber-bg)', color: 'var(--color-amber)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-amber)' }} aria-hidden="true" />
                1 Late
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ fontSize: '10px', fontWeight: 600, background: 'var(--color-red-bg)', color: 'var(--color-red)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-red)' }} aria-hidden="true" />
                1 Missed
              </span>
            </div>

            {/* Timeline */}
            <div className="relative" style={{ paddingLeft: 0 }}>
              {/* Gradient line */}
              <div className="landing-tl-line" aria-hidden="true" />

              {MOCK_MEDS.map((med, i) => (
                <div key={med.name} className="relative" style={{ opacity: med.opacity }}>
                  {/* Dot */}
                  <div
                    className="landing-tl-dot"
                    style={{ background: med.color, top: 16 + i * 0 }}
                    aria-hidden="true"
                  />
                  {/* Card */}
                  <div
                    className={`landing-tl-card ${med.bgClass}`}
                    style={{ borderLeftColor: med.color }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {med.name}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: med.color,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                        background: med.status === 'Next' ? 'var(--color-amber-bg)' : med.status === 'Missed' ? 'var(--color-red-bg)' : 'transparent',
                      }}>
                        {med.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {med.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Voice FAB mock */}
          <div className="landing-fab-mock" aria-hidden="true" style={{ position: 'absolute', bottom: 52, right: 12 }}>
            <MicIcon size={20} strokeWidth={2.5} aria-hidden="true" />
          </div>

          {/* Bottom tabs */}
          <div className="landing-phone-tabs">
            {MOCK_TABS.map((tab) => {
              const active = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`landing-phone-tab${active ? ' landing-phone-tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {active && <span className="landing-phone-tab__indicator" aria-hidden="true" />}
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.6} aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// FeaturesSection — inline, unexported
// ---------------------------------------------------------------------------
function FeaturesSection() {
  const { ref, visible } = useScrollReveal()
  return (
    <section id="features" className="landing-section" aria-labelledby="features-heading" ref={ref}>
      <h2 id="features-heading" className="landing-section__heading">What MarinLoop Does</h2>
      <div className="landing-features-grid">
        {FEATURES.map((f, i) => (
          <FeatureCard
            key={f.title}
            icon={f.icon}
            title={f.title}
            desc={f.desc}
            stagger={i + 1}
            visible={visible}
          />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// HowItWorksSection — inline, unexported
// ---------------------------------------------------------------------------
function HowItWorksSection() {
  const { ref, visible } = useScrollReveal()
  return (
    <section id="how-it-works" className="landing-section" aria-labelledby="how-it-works-heading" ref={ref}>
      <h2 id="how-it-works-heading" className="landing-section__heading">How It Works</h2>
      <div className="landing-steps">
        {STEPS.map((s) => (
          <div key={s.num} className={`landing-step landing-reveal${visible ? ' landing-reveal--visible' : ''}`}>
            <div className="landing-step__number">{s.num}</div>
            <h3 className="landing-step__title">{s.title}</h3>
            <p className="landing-step__desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Trust data
// ---------------------------------------------------------------------------
const TRUST_CELLS = [
  {
    icon: CheckIcon,
    title: 'What MarinLoop Is',
    body: 'A personal medication-management workflow for reminders, adherence tracking, and caregiver coordination.',
  },
  {
    icon: XIcon,
    title: 'What It Is Not',
    body: 'Not a diagnostic tool, not a clinician substitute, not an emergency alerting system, and not a HIPAA deployment for covered-entity workflows in this beta.',
  },
  {
    icon: MicIcon,
    title: 'Optional AI',
    body: 'AI features are opt-in and revocable. Core medication tracking works without AI.',
  },
] as const

// ---------------------------------------------------------------------------
// TrustSection — inline, unexported
// ---------------------------------------------------------------------------
function TrustSection() {
  const { ref, visible } = useScrollReveal()
  return (
    <section id="trust" className="landing-section" aria-labelledby="trust-heading" ref={ref}>
      <h2 id="trust-heading" className="landing-section__heading">Built on Trust</h2>
      <div className={`landing-trust-grid landing-reveal${visible ? ' landing-reveal--visible' : ''}`}>
        {TRUST_CELLS.map((cell) => {
          const Icon = cell.icon
          return (
            <div key={cell.title} className="landing-trust-cell">
              <div className="landing-trust-cell__icon">
                <Icon size={20} strokeWidth={2} aria-hidden="true" />
              </div>
              <h3 className="landing-trust-cell__title">{cell.title}</h3>
              <p className="landing-trust-cell__body">{cell.body}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Under the Hood data
// ---------------------------------------------------------------------------
const HOOD_ITEMS = [
  'Row-Level Security on all tables',
  'AI consent gating (opt-in, revocable)',
  'End-to-end encrypted auth',
  'Full data export and account deletion',
  'Installable PWA on any device',
  'No third-party ad tracking',
] as const

// ---------------------------------------------------------------------------
// UnderTheHoodSection — inline, unexported
// ---------------------------------------------------------------------------
function UnderTheHoodSection() {
  const { ref, visible } = useScrollReveal()
  return (
    <section id="under-the-hood" className="landing-section" aria-labelledby="under-hood-heading" ref={ref}>
      <h2 id="under-hood-heading" className="landing-section__heading">Under the Hood</h2>
      <div className={`landing-hood-grid landing-reveal${visible ? ' landing-reveal--visible' : ''}`}>
        {HOOD_ITEMS.map((item) => (
          <div key={item} className="landing-hood-item">
            <CheckIcon size={20} strokeWidth={2.5} className="landing-hood-item__icon" aria-hidden="true" />
            <span className="landing-hood-item__text">{item}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// CTASection — inline, unexported
// ---------------------------------------------------------------------------
function CTASection({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section id="cta" className="landing-cta" aria-labelledby="cta-heading">
      <h2 id="cta-heading" className="landing-cta__heading">
        Ready to Simplify Your Medication Routine?
      </h2>
      <p className="landing-cta__subtitle">
        Join the open beta. Free for personal use.
      </p>
      <div className="landing-cta__buttons">
        <div className="landing-cta-invert w-auto inline-flex">
          <Button
            variant="primary"
            size="lg"
            onClick={onSignIn}
            className="w-auto min-w-[200px]"
          >
            Get started free
          </Button>
        </div>
        <div className="landing-cta-invert-secondary w-auto inline-flex">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              const el = document.getElementById('trust')
              if (el) el.scrollIntoView({ behavior: 'smooth' })
            }}
            className="w-auto min-w-[200px]"
          >
            Learn more
          </Button>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// LandingScreen
// ---------------------------------------------------------------------------
export function LandingScreen() {
  const { resolvedTheme, toggleTheme } = useThemeStore()
  const { session } = useAuthStore()
  const navigate = useNavigate()

  // Mobile menu
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [mobileOpen, closeMobile])

  if (session) return <Navigate to="/timeline" replace />

  return (
    <div className="landing-page">
      {/* Skip to main content */}
      <a href="#main-content" className="sr-only focus-not-sr-only">
        Skip to main content
      </a>

      {/* ========== NAV ========== */}
      <nav className="landing-nav" aria-label="Main navigation">
        <div className="landing-nav__inner">
          {/* Brand */}
          <div className="landing-nav__brand">
            <div className="landing-nav__logo-box">
              <LogoIcon size={22} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <span className="landing-nav__wordmark">MarinLoop</span>
            <span className="landing-nav__badge">BETA</span>
          </div>

          {/* Desktop links */}
          <ul className="landing-nav__links">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="landing-nav__actions">
            <IconButton
              size="md"
              aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
            >
              {resolvedTheme === 'dark'
                ? <SunIcon size={20} strokeWidth={1.8} />
                : <MoonIcon size={20} strokeWidth={1.8} />}
            </IconButton>

            <div className="w-auto inline-flex">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/login')}
                className="w-auto"
              >
                Sign In
              </Button>
            </div>

            {/* Mobile hamburger — hidden at md+ where desktop links show */}
            <IconButton
              size="md"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((p) => !p)}
              className="md:hidden"
            >
              {mobileOpen ? <XIcon size={20} /> : <HamburgerSvg />}
            </IconButton>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="landing-mobile-menu" role="dialog" aria-label="Mobile navigation">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={closeMobile}>
              {l.label}
            </a>
          ))}
          <a href="#cta" onClick={closeMobile}>
            Get Started
          </a>
        </div>
      )}

      {/* ========== MAIN ========== */}
      <main id="main-content">
        {/* ---- HERO ---- */}
        <section className="landing-hero" aria-labelledby="hero-heading">
          <h1 id="hero-heading" className="landing-hero__headline">
            Medication routines, reminders, and care coordination with a clear safety boundary.
          </h1>
          <p className="landing-hero__subtitle">
            Built for patients and caregivers who need an installable daily workflow for medications, adherence, vitals, notes, and care-network coordination.
          </p>
          <p className="landing-hero__disclaimer">
            {DISCLAIMER}
          </p>

          <div className="landing-hero__ctas">
            <div className="w-auto inline-flex">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/login')}
                className="w-auto min-w-[200px]"
              >
                Open beta sign-in
              </Button>
            </div>
            <div className="w-auto inline-flex">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/trust')}
                className="w-auto min-w-[200px]"
              >
                Review trust center
              </Button>
            </div>
          </div>
        </section>

        {/* ---- PRODUCT PREVIEW ---- */}
        <ProductPreview />

        {/* ---- FEATURES ---- */}
        <FeaturesSection />

        {/* ---- HOW IT WORKS ---- */}
        <HowItWorksSection />

        {/* ---- TRUST ---- */}
        <TrustSection />

        {/* ---- UNDER THE HOOD ---- */}
        <UnderTheHoodSection />

        {/* ---- CTA ---- */}
        <CTASection onSignIn={() => navigate('/login')} />
      </main>

      {/* ========== FOOTER ========== */}
      <footer className="landing-footer" role="contentinfo">
        <div className="landing-footer__links">
          <a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms') }}>Terms</a>
          <a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy') }}>Privacy</a>
          <a href="/trust" onClick={(e) => { e.preventDefault(); navigate('/trust') }}>Trust Center</a>
        </div>
        <p className="landing-footer__disclaimer">
          {DISCLAIMER}
        </p>
        <p className="landing-footer__copyright">
          &copy; {new Date().getFullYear()} MarinLoop. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

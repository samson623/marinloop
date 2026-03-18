import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { LandingScreen } from './LandingScreen'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockAuthStore = {
  session: null as unknown,
  user: null,
  profile: null,
  initialize: vi.fn(),
}

const mockThemeStore = {
  theme: 'light' as const,
  resolvedTheme: 'light' as 'light' | 'dark',
  setTheme: vi.fn(),
  toggleTheme: vi.fn(),
}

vi.mock('@/shared/stores/auth-store', () => {
  const fn = (selector?: (s: typeof mockAuthStore) => unknown) =>
    selector ? selector(mockAuthStore) : mockAuthStore
  fn.getState = () => mockAuthStore
  fn.setState = vi.fn()
  fn.subscribe = vi.fn()
  return { useAuthStore: fn }
})

vi.mock('@/shared/stores/theme-store', () => {
  const fn = (selector?: (s: typeof mockThemeStore) => unknown) =>
    selector ? selector(mockThemeStore) : mockThemeStore
  fn.getState = () => mockThemeStore
  fn.setState = vi.fn()
  fn.subscribe = vi.fn()
  return { useThemeStore: fn }
})

// Mock matchMedia + IntersectionObserver for scroll reveal
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  const io = vi.fn((cb: IntersectionObserverCallback) => {
    // Immediately trigger with isIntersecting=true for all observed elements
    const trigger = (entries: IntersectionObserverEntry[]) => cb(entries, {} as IntersectionObserver)
    return {
      observe: (el: Element) => {
        trigger([{ target: el, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry])
      },
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })
  vi.stubGlobal('IntersectionObserver', io)
})

// ---------------------------------------------------------------------------
// Phase 1 Tests
// ---------------------------------------------------------------------------
describe('LandingScreen — Phase 1: Foundation', () => {
  it('redirects to /timeline when session exists', () => {
    mockAuthStore.session = { access_token: 'tok' }

    renderWithProviders(<LandingScreen />, { initialEntries: ['/landing'] })
    // Should not render hero when redirected
    expect(screen.queryByText(/Medication routines/)).toBeNull()

    // Restore
    mockAuthStore.session = null
  })

  it('renders the hero heading', () => {
    renderWithProviders(<LandingScreen />)
    expect(
      screen.getByRole('heading', { level: 1, name: /Medication routines/ }),
    ).toBeInTheDocument()
  })

  it('has a skip-to-content link', () => {
    renderWithProviders(<LandingScreen />)
    const skip = screen.getByText('Skip to main content')
    expect(skip).toBeInTheDocument()
    expect(skip.getAttribute('href')).toBe('#main-content')
  })

  it('renders both CTA buttons', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByRole('button', { name: 'Open beta sign-in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review trust center' })).toBeInTheDocument()
  })

  it('renders disclaimer text in hero and footer', () => {
    renderWithProviders(<LandingScreen />)
    const disclaimers = screen.getAllByText(/not a medical device/)
    expect(disclaimers.length).toBeGreaterThanOrEqual(2) // hero + footer
  })

  it('opens and closes mobile menu', () => {
    renderWithProviders(<LandingScreen />)
    const toggle = screen.getByRole('button', { name: 'Open menu' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    // Close
    fireEvent.click(toggle)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes mobile menu on Escape', () => {
    renderWithProviders(<LandingScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('theme toggle has accessible label', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByRole('button', { name: /Switch to dark theme/i })).toBeInTheDocument()
  })

  it('nav has correct role and aria-label', () => {
    renderWithProviders(<LandingScreen />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav).toBeInTheDocument()
  })

  it('footer has contentinfo role', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('has exactly one h1', () => {
    renderWithProviders(<LandingScreen />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
  })

  it('nav links have correct href values', () => {
    renderWithProviders(<LandingScreen />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const links = nav.querySelectorAll('a[href^="#"]')
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('#features')
    expect(hrefs).toContain('#how-it-works')
    expect(hrefs).toContain('#trust')
  })

  it('footer contains Terms, Privacy, Trust Center links', () => {
    renderWithProviders(<LandingScreen />)
    const footer = screen.getByRole('contentinfo')
    expect(footer.textContent).toContain('Terms')
    expect(footer.textContent).toContain('Privacy')
    expect(footer.textContent).toContain('Trust Center')
  })
})

// ---------------------------------------------------------------------------
// Phase 2 Tests
// ---------------------------------------------------------------------------
describe('LandingScreen — Phase 2: Features + How It Works', () => {
  it('renders Features heading', () => {
    renderWithProviders(<LandingScreen />)
    expect(
      screen.getByRole('heading', { level: 2, name: /What MarinLoop Does/ }),
    ).toBeInTheDocument()
  })

  it('renders all 6 feature cards', () => {
    renderWithProviders(<LandingScreen />)
    const titles = [
      'Daily Timeline',
      'Push Reminders',
      'Medication Management',
      'Health Tracking',
      'Care Network',
      'AI Assistant',
    ]
    titles.forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument()
    })
  })

  it('AI feature card says "Optional, informational tools only"', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByText(/Optional, informational tools only/)).toBeInTheDocument()
  })

  it('Features section has aria-labelledby', () => {
    renderWithProviders(<LandingScreen />)
    const section = document.getElementById('features')
    expect(section).not.toBeNull()
    expect(section!.getAttribute('aria-labelledby')).toBe('features-heading')
  })

  it('renders How It Works heading', () => {
    renderWithProviders(<LandingScreen />)
    expect(
      screen.getByRole('heading', { level: 2, name: /How It Works/ }),
    ).toBeInTheDocument()
  })

  it('renders all 3 steps', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByText('Add Medications')).toBeInTheDocument()
    expect(screen.getByText('Set Reminders')).toBeInTheDocument()
    expect(screen.getByText('Track Adherence')).toBeInTheDocument()
  })

  it('How It Works section has aria-labelledby', () => {
    renderWithProviders(<LandingScreen />)
    const section = document.getElementById('how-it-works')
    expect(section).not.toBeNull()
    expect(section!.getAttribute('aria-labelledby')).toBe('how-it-works-heading')
  })

  it('scroll reveal adds visible class', () => {
    renderWithProviders(<LandingScreen />)
    // IntersectionObserver mock triggers immediately, so cards should be visible
    const cards = document.querySelectorAll('.landing-feature-card')
    expect(cards.length).toBe(6)
    cards.forEach((card) => {
      expect(card.classList.contains('landing-reveal--visible')).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Phase 3 Tests
// ---------------------------------------------------------------------------
describe('LandingScreen — Phase 3: Product Preview', () => {
  it('renders the preview section heading', () => {
    renderWithProviders(<LandingScreen />)
    expect(
      screen.getByRole('heading', { level: 2, name: /See It in Action/ }),
    ).toBeInTheDocument()
  })

  it('adherence ring has role="img" and aria-label', () => {
    renderWithProviders(<LandingScreen />)
    const ring = screen.getByRole('img', { name: /Adherence: \d+%/ })
    expect(ring).toBeInTheDocument()
  })

  it('shows all 5 medication names', () => {
    renderWithProviders(<LandingScreen />)
    const meds = ['Ciprofloxacin', 'Gabapentin', 'Vitamin D3', 'Aspirin', 'Metformin']
    meds.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument()
    })
  })

  it('status pills show Done, Late, Missed', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByText(/\d+ Done/)).toBeInTheDocument()
    expect(screen.getByText(/\d+ Late/)).toBeInTheDocument()
    expect(screen.getByText(/\d+ Missed/)).toBeInTheDocument()
  })

  it('renders all 5 bottom tab names', () => {
    renderWithProviders(<LandingScreen />)
    const tabNames = ['Timeline', 'Meds', 'Appts', 'Health', 'Care']
    tabNames.forEach((name) => {
      // Tab labels appear both in nav links and in the phone mock.
      // Just verify at least one instance exists for each tab.
      const elements = screen.getAllByText(name)
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('phone frame has descriptive aria-label', () => {
    renderWithProviders(<LandingScreen />)
    const frame = screen.getByRole('img', { name: /MarinLoop app preview/ })
    expect(frame).toBeInTheDocument()
  })

  it('preview section has aria-labelledby', () => {
    renderWithProviders(<LandingScreen />)
    const section = document.getElementById('preview')
    expect(section).not.toBeNull()
    expect(section!.getAttribute('aria-labelledby')).toBe('preview-heading')
  })
})

// ---------------------------------------------------------------------------
// Phase 4 Tests
// ---------------------------------------------------------------------------
describe('LandingScreen — Phase 4: Trust + Under the Hood', () => {
  it('renders Trust heading', () => {
    renderWithProviders(<LandingScreen />)
    expect(
      screen.getByRole('heading', { level: 2, name: /Built on Trust/ }),
    ).toBeInTheDocument()
  })

  it('renders all 3 trust cells with correct headings', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByText('What MarinLoop Is')).toBeInTheDocument()
    expect(screen.getByText('What It Is Not')).toBeInTheDocument()
    expect(screen.getByText('Optional AI')).toBeInTheDocument()
  })

  it('trust section has aria-labelledby', () => {
    renderWithProviders(<LandingScreen />)
    const section = document.getElementById('trust')
    expect(section).not.toBeNull()
    expect(section!.getAttribute('aria-labelledby')).toBe('trust-heading')
  })

  it('renders Under the Hood heading', () => {
    renderWithProviders(<LandingScreen />)
    expect(
      screen.getByRole('heading', { level: 2, name: /Under the Hood/ }),
    ).toBeInTheDocument()
  })

  it('"Row-Level Security" text is present', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByText(/Row-Level Security/)).toBeInTheDocument()
  })

  it('"AI consent" text is present', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByText(/AI consent gating/)).toBeInTheDocument()
  })

  it('under-the-hood section has aria-labelledby', () => {
    renderWithProviders(<LandingScreen />)
    const section = document.getElementById('under-the-hood')
    expect(section).not.toBeNull()
    expect(section!.getAttribute('aria-labelledby')).toBe('under-hood-heading')
  })

  it('disclaimer exact string appears in hero', () => {
    renderWithProviders(<LandingScreen />)
    const exact = 'MarinLoop is a personal tracking and reminder product. It is not a medical device, not for emergency use, and not offered in this beta for covered-entity workflows requiring HIPAA business associate agreements.'
    const matches = screen.getAllByText(exact)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Phase 5 Tests
// ---------------------------------------------------------------------------
describe('LandingScreen — Phase 5: CTA + Responsive Polish', () => {
  it('renders CTA heading', () => {
    renderWithProviders(<LandingScreen />)
    expect(
      screen.getByRole('heading', { level: 2, name: /Ready to Simplify/ }),
    ).toBeInTheDocument()
  })

  it('renders CTA subtitle', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByText(/Join the open beta/)).toBeInTheDocument()
  })

  it('CTA has two buttons', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getByRole('button', { name: 'Get started free' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument()
  })

  it('CTA section has aria-labelledby', () => {
    renderWithProviders(<LandingScreen />)
    const section = document.getElementById('cta')
    expect(section).not.toBeNull()
    expect(section!.getAttribute('aria-labelledby')).toBe('cta-heading')
  })

  it('nav links have correct href attributes for smooth scroll', () => {
    renderWithProviders(<LandingScreen />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const featureLink = nav.querySelector('a[href="#features"]')
    const howLink = nav.querySelector('a[href="#how-it-works"]')
    const trustLink = nav.querySelector('a[href="#trust"]')
    expect(featureLink).not.toBeNull()
    expect(howLink).not.toBeNull()
    expect(trustLink).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Phase 6 Tests — Accessibility Audit + Dark Mode + Final
// ---------------------------------------------------------------------------
describe('LandingScreen — Phase 6: Accessibility Audit', () => {
  it('heading hierarchy: exactly 1 h1 and correct number of h2s', () => {
    renderWithProviders(<LandingScreen />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    // h2: See It in Action, What MarinLoop Does, How It Works, Built on Trust, Under the Hood, Ready to Simplify
    const h2s = screen.getAllByRole('heading', { level: 2 })
    expect(h2s.length).toBe(6)
  })

  it('all section IDs are unique', () => {
    renderWithProviders(<LandingScreen />)
    const sectionIds = ['features', 'how-it-works', 'preview', 'trust', 'under-the-hood', 'cta']
    const found = sectionIds.map((id) => document.getElementById(id))
    found.forEach((el, i) => {
      expect(el).not.toBeNull()
      // Verify no duplicates by checking querySelectorAll
      expect(document.querySelectorAll(`#${sectionIds[i]}`).length).toBe(1)
    })
  })

  it('all aria-labelledby attributes reference existing IDs', () => {
    renderWithProviders(<LandingScreen />)
    const labeled = document.querySelectorAll('[aria-labelledby]')
    labeled.forEach((el) => {
      const targetId = el.getAttribute('aria-labelledby')!
      expect(document.getElementById(targetId)).not.toBeNull()
    })
  })

  it('decorative SVGs in nav brand are aria-hidden', () => {
    renderWithProviders(<LandingScreen />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const logoSvg = nav.querySelector('.landing-nav__logo-box svg')
    expect(logoSvg).not.toBeNull()
    expect(logoSvg!.getAttribute('aria-hidden')).toBe('true')
  })

  it('feature card icons are aria-hidden', () => {
    renderWithProviders(<LandingScreen />)
    const iconContainers = document.querySelectorAll('.landing-feature-card__icon svg')
    expect(iconContainers.length).toBe(6)
    iconContainers.forEach((svg) => {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
    })
  })

  it('no tabindex > 0 anywhere', () => {
    renderWithProviders(<LandingScreen />)
    const allTabindexed = document.querySelectorAll('[tabindex]')
    allTabindexed.forEach((el) => {
      const val = parseInt(el.getAttribute('tabindex')!, 10)
      expect(val).toBeLessThanOrEqual(0)
    })
  })

  it('skip link is the first focusable element', () => {
    renderWithProviders(<LandingScreen />)
    const page = document.querySelector('.landing-page')
    // First child with href or button role
    const firstFocusable = page!.querySelector('a[href], button, [tabindex="0"]')
    expect(firstFocusable).not.toBeNull()
    expect(firstFocusable!.textContent).toBe('Skip to main content')
  })

  it('mobile menu toggle has aria-expanded', () => {
    renderWithProviders(<LandingScreen />)
    const toggle = screen.getByRole('button', { name: 'Open menu' })
    expect(toggle.hasAttribute('aria-expanded')).toBe(true)
  })

  it('dark mode render does not throw', () => {
    mockThemeStore.resolvedTheme = 'dark'
    expect(() => renderWithProviders(<LandingScreen />)).not.toThrow()
    // Verify it still renders content
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    mockThemeStore.resolvedTheme = 'light'
  })

  it('dark mode theme toggle shows sun icon label', () => {
    mockThemeStore.resolvedTheme = 'dark'
    renderWithProviders(<LandingScreen />)
    expect(screen.getByRole('button', { name: /Switch to light theme/i })).toBeInTheDocument()
    mockThemeStore.resolvedTheme = 'light'
  })

  it('all under-the-hood items render', () => {
    renderWithProviders(<LandingScreen />)
    const items = [
      'Row-Level Security on all tables',
      'AI consent gating (opt-in, revocable)',
      'End-to-end encrypted auth',
      'Full data export and account deletion',
      'Installable PWA on any device',
      'No third-party ad tracking',
    ]
    items.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument()
    })
  })

  it('main landmark has id="main-content"', () => {
    renderWithProviders(<LandingScreen />)
    const main = screen.getByRole('main')
    expect(main.id).toBe('main-content')
  })

  it('copyright year is current', () => {
    renderWithProviders(<LandingScreen />)
    const year = new Date().getFullYear().toString()
    const footer = screen.getByRole('contentinfo')
    expect(footer.textContent).toContain(year)
  })
})

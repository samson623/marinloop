import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { PhoneDemo } from './PhoneDemo'

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

// Mock matchMedia + IntersectionObserver (non-triggering to prevent demo auto-start)
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })))
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function clickTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }))
}

function renderDemo() {
  return renderWithProviders(<PhoneDemo />)
}

// ===========================================================================
// Suite 1: Rendering
// ===========================================================================
describe('PhoneDemo — Rendering', () => {
  it('renders the section heading "See It in Action"', () => {
    renderDemo()
    expect(screen.getByRole('heading', { level: 2, name: /See It in Action/ })).toBeInTheDocument()
  })

  it('phone frame has role="img" with descriptive aria-label', () => {
    renderDemo()
    const frame = screen.getByRole('img', { name: /MarinLoop app preview/ })
    expect(frame).toBeInTheDocument()
  })

  it('preview section has id="preview" and aria-labelledby="preview-heading"', () => {
    renderDemo()
    const section = document.getElementById('preview')
    expect(section).not.toBeNull()
    expect(section!.getAttribute('aria-labelledby')).toBe('preview-heading')
  })

  it('renders the phone header with "MarinLoop" brand text and "BETA" badge', () => {
    renderDemo()
    expect(screen.getByText('MarinLoop')).toBeInTheDocument()
    expect(screen.getByText('BETA')).toBeInTheDocument()
  })

  it('renders all 5 medication names', () => {
    renderDemo()
    for (const name of ['Ciprofloxacin', 'Gabapentin', 'Vitamin D3', 'Aspirin', 'Metformin']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })

  it('renders adherence ring SVG with role="img" and aria-label', () => {
    renderDemo()
    const ring = screen.getByRole('img', { name: /Adherence: \d+%/ })
    expect(ring).toBeInTheDocument()
  })

  it('renders status pills (Done, Late, Missed)', () => {
    renderDemo()
    expect(screen.getByText(/\d+ Done/)).toBeInTheDocument()
    expect(screen.getByText(/\d+ Late/)).toBeInTheDocument()
    expect(screen.getByText(/\d+ Missed/)).toBeInTheDocument()
  })

  it('renders the timeline gradient line', () => {
    renderDemo()
    expect(document.querySelector('.demo-tl__line')).not.toBeNull()
  })

  it('renders the voice FAB with aria-hidden', () => {
    renderDemo()
    const fab = document.querySelector('.demo-fab')
    expect(fab).not.toBeNull()
    expect(fab!.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows status badge text', () => {
    renderDemo()
    expect(document.querySelector('[data-testid="demo-status"]')).not.toBeNull()
  })

  it('renders subtitle "Watch it work — or tap to take over"', () => {
    renderDemo()
    expect(screen.getByText(/Watch it work/)).toBeInTheDocument()
  })
})

// ===========================================================================
// Suite 2: Tab Navigation
// ===========================================================================
describe('PhoneDemo — Tab Navigation', () => {
  it('renders all 5 tab buttons', () => {
    renderDemo()
    for (const name of [/Timeline/i, /Meds/i, /Appts/i, /Health/i, /Care/i]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument()
    }
  })

  it('Timeline tab is active by default', () => {
    renderDemo()
    expect(screen.getByRole('tab', { name: /Timeline/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking "Meds" tab switches to Meds screen', () => {
    renderDemo()
    clickTab('Meds')
    expect(screen.getByText('Medications')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('clicking "Health" tab shows Health screen', () => {
    renderDemo()
    clickTab('Health')
    expect(screen.getByText('Blood Pressure')).toBeInTheDocument()
    expect(screen.getByText('Heart Rate')).toBeInTheDocument()
  })

  it('clicking "Appts" tab shows Appointments screen', () => {
    renderDemo()
    clickTab('Appts')
    expect(screen.getByText(/Dr\. Patel — Cardiology/)).toBeInTheDocument()
  })

  it('clicking "Care" tab shows Care Network screen', () => {
    renderDemo()
    clickTab('Care')
    expect(screen.getByText('Dr. Sanjay Patel')).toBeInTheDocument()
    expect(screen.getByText('Maria Reyes')).toBeInTheDocument()
  })

  it('clicking back to Timeline shows timeline content', () => {
    renderDemo()
    clickTab('Health')
    expect(screen.queryByText('Ciprofloxacin')).not.toBeInTheDocument()
    clickTab('Timeline')
    expect(screen.getByText('Ciprofloxacin')).toBeInTheDocument()
  })

  it('only one tab has aria-selected="true" at a time', () => {
    renderDemo()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.filter(t => t.getAttribute('aria-selected') === 'true')).toHaveLength(1)
    clickTab('Care')
    expect(tabs.filter(t => t.getAttribute('aria-selected') === 'true')).toHaveLength(1)
  })

  it('tab bar has role="tablist" with aria-label', () => {
    renderDemo()
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'App sections')
  })
})

// ===========================================================================
// Suite 3: Accessibility
// ===========================================================================
describe('PhoneDemo — Accessibility', () => {
  it('ghost cursor has aria-hidden="true"', () => {
    const { container } = renderDemo()
    const cursor = container.querySelector('.demo-cursor')
    expect(cursor).toBeInTheDocument()
    expect(cursor).toHaveAttribute('aria-hidden', 'true')
  })

  it('voice FAB has aria-hidden="true"', () => {
    const { container } = renderDemo()
    const fab = container.querySelector('.demo-fab')
    expect(fab).toHaveAttribute('aria-hidden', 'true')
  })

  it('caption element has aria-live="polite"', () => {
    const { container } = renderDemo()
    const caption = container.querySelector('.demo-caption')
    expect(caption).toHaveAttribute('aria-live', 'polite')
  })

  it('phone frame has role="img"', () => {
    const { container } = renderDemo()
    const phone = container.querySelector('.demo-phone')
    expect(phone).toHaveAttribute('role', 'img')
    expect(phone!.getAttribute('aria-label')!.length).toBeGreaterThan(10)
  })

  it('all SVGs in phone header have aria-hidden="true"', () => {
    const { container } = renderDemo()
    const header = container.querySelector('.demo-phone__header')
    header!.querySelectorAll('svg').forEach(svg => {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })
  })

  it('tab bar uses proper ARIA roles and attributes', () => {
    renderDemo()
    const tablist = screen.getByRole('tablist')
    expect(tablist).toHaveAttribute('aria-label', 'App sections')
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    tabs.forEach(tab => {
      expect(tab).toHaveAttribute('aria-selected')
    })
  })

  it('status pill dots have aria-hidden="true"', () => {
    const { container } = renderDemo()
    container.querySelectorAll('.demo-pill__dot').forEach(dot => {
      expect(dot).toHaveAttribute('aria-hidden', 'true')
    })
  })

  it('no tabindex > 0 anywhere', () => {
    const { container } = renderDemo()
    container.querySelectorAll('[tabindex]').forEach(el => {
      expect(parseInt(el.getAttribute('tabindex')!, 10)).toBeLessThanOrEqual(0)
    })
  })

  it('adherence ring has a <title> element', () => {
    const { container } = renderDemo()
    const ring = container.querySelector('svg[role="img"][aria-label]')
    const title = ring!.querySelector('title')
    expect(title).toBeInTheDocument()
    expect(title!.textContent).toMatch(/adherence/i)
  })

  it('section has proper aria-labelledby', () => {
    renderDemo()
    const section = document.getElementById('preview')
    expect(section).toHaveAttribute('aria-labelledby', 'preview-heading')
    const heading = document.getElementById('preview-heading')
    expect(heading!.tagName).toBe('H2')
  })
})

// ===========================================================================
// Suite 4: Content Fidelity
// ===========================================================================
describe('PhoneDemo — Content Fidelity', () => {
  it('Timeline shows all 5 medication times', () => {
    renderDemo()
    for (const t of ['12:07 AM', '9:11 PM', '6:00 PM', '9:00 PM', '8:00 AM']) {
      expect(screen.getByText(t)).toBeInTheDocument()
    }
  })

  it('Timeline shows correct day name', () => {
    renderDemo()
    expect(screen.getByText(DAYS[new Date().getDay()])).toBeInTheDocument()
  })

  it('Meds screen shows all 5 dosages', () => {
    renderDemo()
    clickTab('Meds')
    for (const d of ['500mg', '100 MG', '2000 IU', '81mg']) {
      expect(screen.getAllByText(new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('Meds screen shows frequencies', () => {
    renderDemo()
    clickTab('Meds')
    expect(screen.getAllByText(/2x daily/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/1x daily/).length).toBeGreaterThanOrEqual(1)
  })

  it('Health screen shows all 4 vital values', () => {
    renderDemo()
    clickTab('Health')
    for (const v of ['128', '72', '174', '82%']) {
      expect(screen.getByText(v)).toBeInTheDocument()
    }
  })

  it('Health screen shows all trend descriptions', () => {
    renderDemo()
    clickTab('Health')
    for (const t of ['↓ 4 from last week', '— Stable', '↓ 2 lbs this month', '↑ 5% from last week']) {
      expect(screen.getByText(t)).toBeInTheDocument()
    }
  })

  it('Appts screen shows both month labels', () => {
    renderDemo()
    clickTab('Appts')
    expect(screen.getByText('March 2026')).toBeInTheDocument()
    expect(screen.getByText('February 2026')).toBeInTheDocument()
  })

  it('Appts screen shows all 3 appointment titles', () => {
    renderDemo()
    clickTab('Appts')
    for (const t of ['Dr. Patel — Cardiology', 'Lab Work — Bloodwork', 'Dr. Lee — Primary Care']) {
      expect(screen.getByText(t)).toBeInTheDocument()
    }
  })

  it('Care screen shows all 4 contact initials', () => {
    renderDemo()
    clickTab('Care')
    for (const i of ['SP', 'MR', 'JL', 'TW']) {
      expect(screen.getByText(i)).toBeInTheDocument()
    }
  })

  it('Care screen shows 3 Active and 1 Pending badges', () => {
    renderDemo()
    clickTab('Care')
    expect(screen.getAllByText('Active')).toHaveLength(3)
    expect(screen.getAllByText('Pending')).toHaveLength(1)
  })
})

// ===========================================================================
// Suite 5: Demo Sequencer (Phase 2)
// ===========================================================================
describe('PhoneDemo — Demo Sequencer', () => {
  it('replay button is not shown when demo has not been started', () => {
    renderDemo()
    // Demo hasn't started (IO not triggered), so no replay button
    expect(screen.queryByRole('button', { name: /Replay demo/i })).not.toBeInTheDocument()
  })

  it('pointer interaction on phone does not crash when demo is not running', () => {
    renderDemo()
    const phone = document.querySelector('.demo-phone')!
    // Should not throw even when demo isn't running
    expect(() => fireEvent.pointerDown(phone)).not.toThrow()
    const status = document.querySelector('[data-testid="demo-status"]')
    expect(status).toBeInTheDocument()
  })

  it('ghost cursor is hidden by default (demo not running)', () => {
    const { container } = renderDemo()
    const cursor = container.querySelector('.demo-cursor')
    expect(cursor).not.toHaveClass('demo-cursor--visible')
  })

  it('toast element is not rendered when no toast message', () => {
    const { container } = renderDemo()
    const toast = container.querySelector('.demo-toast')
    expect(toast).toBeNull()
  })

  it('caption is empty by default (demo not running)', () => {
    const { container } = renderDemo()
    const caption = container.querySelector('.demo-caption')
    expect(caption!.textContent).toBe('')
  })
})

// ===========================================================================
// Suite 6: Timeline Card Expansion
// ===========================================================================
describe('PhoneDemo — Timeline Card Expansion', () => {
  it('clicking a timeline card expands it showing detail rows (Dosage, Frequency, Supply)', () => {
    renderDemo()
    // Vitamin D3 is med-3, status=next
    const card = document.querySelector('[data-demo-target="med-3"]')!
    fireEvent.click(card)
    expect(screen.getByText('Dosage')).toBeInTheDocument()
    expect(screen.getByText('Frequency')).toBeInTheDocument()
    expect(screen.getByText('Supply')).toBeInTheDocument()
    // Check actual values for Vitamin D3
    expect(screen.getByText('2000 IU')).toBeInTheDocument()
    expect(screen.getByText('1x daily')).toBeInTheDocument()
    expect(screen.getByText('60 pills')).toBeInTheDocument()
  })

  it('expanded card shows action buttons (Done, Late, Skip) for non-done cards', () => {
    renderDemo()
    const card = document.querySelector('[data-demo-target="med-3"]')!
    fireEvent.click(card)
    expect(document.querySelector('[data-demo-target="action-done-3"]')).toBeInTheDocument()
    expect(document.querySelector('[data-demo-target="action-late-3"]')).toBeInTheDocument()
    expect(document.querySelector('[data-demo-target="action-skip-3"]')).toBeInTheDocument()
  })

  it('expanded card shows Undo button for done cards', () => {
    renderDemo()
    // Metformin is med-1, status=done
    const card = document.querySelector('[data-demo-target="med-1"]')!
    fireEvent.click(card)
    expect(screen.getByText('Undo')).toBeInTheDocument()
    expect(document.querySelector('[data-demo-target="action-undo-1"]')).toBeInTheDocument()
    // Should NOT have Done/Late/Skip
    expect(document.querySelector('[data-demo-target="action-done-1"]')).toBeNull()
    expect(document.querySelector('[data-demo-target="action-late-1"]')).toBeNull()
    expect(document.querySelector('[data-demo-target="action-skip-1"]')).toBeNull()
  })

  it('clicking an expanded card again collapses it', () => {
    renderDemo()
    const card = document.querySelector('[data-demo-target="med-3"]')!
    fireEvent.click(card)
    expect(screen.getByText('Dosage')).toBeInTheDocument()
    // Click again to collapse
    fireEvent.click(card)
    expect(screen.queryByText('Dosage')).not.toBeInTheDocument()
  })

  it('only one card can be expanded at a time', () => {
    renderDemo()
    // Expand med-3
    fireEvent.click(document.querySelector('[data-demo-target="med-3"]')!)
    expect(screen.getByText('60 pills')).toBeInTheDocument() // Vitamin D3 supply
    // Now expand med-2 (Gabapentin)
    fireEvent.click(document.querySelector('[data-demo-target="med-2"]')!)
    expect(screen.getByText('30 pills')).toBeInTheDocument() // Gabapentin supply
    // Vitamin D3's detail should be gone
    expect(screen.queryByText('60 pills')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Suite 7: Medication Detail Drill-in
// ===========================================================================
describe('PhoneDemo — Medication Detail Drill-in', () => {
  it('clicking a med in Meds list opens detail panel', () => {
    renderDemo()
    clickTab('Meds')
    fireEvent.click(document.querySelector('[data-demo-target="medlist-2"]')!)
    expect(screen.getByTestId('med-detail-panel')).toBeInTheDocument()
    expect(screen.getByText('Gabapentin')).toBeInTheDocument()
  })

  it('detail panel shows info rows: Schedule, Frequency, Supply, Instructions', () => {
    renderDemo()
    clickTab('Meds')
    fireEvent.click(document.querySelector('[data-demo-target="medlist-2"]')!)
    const panel = screen.getByTestId('med-detail-panel')
    expect(within(panel).getByText('Schedule')).toBeInTheDocument()
    expect(within(panel).getByText('Frequency')).toBeInTheDocument()
    expect(within(panel).getByText('Supply')).toBeInTheDocument()
    expect(within(panel).getByText('Instructions')).toBeInTheDocument()
    // Gabapentin values
    expect(within(panel).getByText('100 MG')).toBeInTheDocument()
    expect(within(panel).getAllByText(/1x daily/).length).toBeGreaterThanOrEqual(1)
    expect(within(panel).getByText('9:11 PM')).toBeInTheDocument()
  })

  it('detail panel shows supply bar with percentage', () => {
    renderDemo()
    clickTab('Meds')
    fireEvent.click(document.querySelector('[data-demo-target="medlist-2"]')!)
    const panel = screen.getByTestId('med-detail-panel')
    expect(within(panel).getByText('Supply remaining')).toBeInTheDocument()
    expect(within(panel).getByText('100%')).toBeInTheDocument()
    expect(panel.querySelector('.demo-supply-fill')).toBeInTheDocument()
  })

  it('detail panel shows Side Effects section', () => {
    renderDemo()
    clickTab('Meds')
    fireEvent.click(document.querySelector('[data-demo-target="medlist-2"]')!)
    const panel = screen.getByTestId('med-detail-panel')
    expect(within(panel).getByText('Side Effects')).toBeInTheDocument()
    expect(within(panel).getByText('+ Log')).toBeInTheDocument()
    expect(within(panel).getByText(/No side effects logged/)).toBeInTheDocument()
  })

  it('detail panel shows Edit and Discontinue buttons', () => {
    renderDemo()
    clickTab('Meds')
    fireEvent.click(document.querySelector('[data-demo-target="medlist-2"]')!)
    const panel = screen.getByTestId('med-detail-panel')
    expect(within(panel).getByText(/Edit/)).toBeInTheDocument()
    expect(within(panel).getByText('Discontinue')).toBeInTheDocument()
    expect(within(panel).getByText('Delete permanently')).toBeInTheDocument()
  })

  it('close button closes detail and returns to list', () => {
    renderDemo()
    clickTab('Meds')
    fireEvent.click(document.querySelector('[data-demo-target="medlist-2"]')!)
    expect(screen.getByTestId('med-detail-panel')).toBeInTheDocument()
    // Click the close button
    fireEvent.click(document.querySelector('[data-demo-target="med-detail-back"]')!)
    expect(screen.queryByTestId('med-detail-panel')).not.toBeInTheDocument()
    // Should be back on the meds list
    expect(screen.getByText('Medications')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('detail panel has data-testid="med-detail-panel"', () => {
    renderDemo()
    clickTab('Meds')
    fireEvent.click(document.querySelector('[data-demo-target="medlist-2"]')!)
    const panel = screen.getByTestId('med-detail-panel')
    expect(panel).toBeInTheDocument()
  })
})

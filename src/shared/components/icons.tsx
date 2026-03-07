/**
 * icons.tsx — marinloop unified icon system
 *
 * All icons are React.forwardRef SVG components with a consistent API.
 * Colors are inherited via currentColor — set text-* on a parent or via className.
 * Icons are decorative by default (aria-hidden="true"). Pass a `title` prop or
 * aria-label on the parent to make an icon semantically meaningful.
 *
 * Usage:
 *   <ClockIcon size={22} strokeWidth={2.2} aria-hidden />
 *   <BellIcon size={20} className="text-blue-500" title="Notifications" />
 *   <CheckIcon size={16} aria-hidden="true" />
 */

import React from 'react'

// ---------------------------------------------------------------------------
// Base interface
// ---------------------------------------------------------------------------

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /**
   * Width and height of the icon in pixels (or any valid CSS length string).
   * Defaults to 20.
   */
  size?: number | string
  /**
   * SVG stroke width. Defaults to 2.
   */
  strokeWidth?: number
  /**
   * When provided, renders a <title> element as the first SVG child so that
   * screen readers announce the icon's purpose. Only needed when the icon is
   * the sole accessible label for an interactive element.
   */
  title?: string
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function SvgTitle({ title }: { title?: string }) {
  return title ? <title>{title}</title> : null
}

// ---------------------------------------------------------------------------
// Navigation Tab Icons
// ---------------------------------------------------------------------------

/**
 * ClockIcon — Timeline tab. Circle with clock hands.
 * Used in: App.tsx nav tab, MedsView card detail row.
 */
export const ClockIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
)
ClockIcon.displayName = 'ClockIcon'

/**
 * PillIcon — Meds tab. Pill bottle shape (cap + rectangular body).
 * Used in: App.tsx nav tab, MedsView empty state.
 */
export const PillIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M9 2h6a2 2 0 012 2v1H7V4a2 2 0 012-2z" />
      <rect x="7" y="5" width="10" height="16" rx="2" />
    </svg>
  ),
)
PillIcon.displayName = 'PillIcon'

/**
 * CalendarIcon — Appointments tab. Rectangle with date markers.
 * Used in: App.tsx nav tab, NotificationsPanel day-group header.
 */
export const CalendarIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
)
CalendarIcon.displayName = 'CalendarIcon'

/**
 * BarChartIcon — Health/Summary tab. Three rising bars.
 * Used in: App.tsx nav tab, MedsView frequency row.
 */
export const BarChartIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  ),
)
BarChartIcon.displayName = 'BarChartIcon'

/**
 * UsersIcon — Care tab. Two people silhouettes.
 * Used in: App.tsx nav tab, CareView empty caregivers state.
 */
export const UsersIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
)
UsersIcon.displayName = 'UsersIcon'

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

/**
 * LogoIcon — marinloop brand mark. Layered diamond/stacked chevrons.
 * Used in: App.tsx header logo container.
 */
export const LogoIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2.5, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
)
LogoIcon.displayName = 'LogoIcon'

// ---------------------------------------------------------------------------
// Header / Shell Icons
// ---------------------------------------------------------------------------

/**
 * BellAlarmIcon — Reminders alarm bell. Clock face inside bell body.
 * Used in: App.tsx header reminders button.
 */
export const BellAlarmIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <circle cx="12" cy="12" r="7" />
      <polyline points="12 9 12 12 13.5 13.5" />
      <path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-1.99 1.82H9.83a2 2 0 0 1-1.99-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 1.99 1.82l.35 3.83" />
    </svg>
  ),
)
BellAlarmIcon.displayName = 'BellAlarmIcon'

/**
 * BellIcon — Standard notification bell.
 * Used in: App.tsx header notifications button, NotificationsPanel empty state.
 */
export const BellIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
    </svg>
  ),
)
BellIcon.displayName = 'BellIcon'

/**
 * SunIcon — Theme toggle: light mode indicator. Circle with radiating lines.
 * Used in: App.tsx theme toggle button (shown when current theme is dark).
 */
export const SunIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 1.8, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
)
SunIcon.displayName = 'SunIcon'

/**
 * MoonIcon — Theme toggle: dark mode indicator. Crescent moon shape.
 * Used in: App.tsx theme toggle button (shown when current theme is light).
 */
export const MoonIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 1.8, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
)
MoonIcon.displayName = 'MoonIcon'

/**
 * MicIcon — Voice input microphone with stand and base.
 * Used in: App.tsx voice FAB button.
 */
export const MicIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
)
MicIcon.displayName = 'MicIcon'

// ---------------------------------------------------------------------------
// Chevron / Arrow Icons
// ---------------------------------------------------------------------------

/**
 * ChevronDownIcon — Collapse / expand indicator, jump-to-now button.
 * Used in: App.tsx notifications collapse, RemindersPanel recent toggle,
 *          TimelineView jump-to-now button.
 */
export const ChevronDownIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
)
ChevronDownIcon.displayName = 'ChevronDownIcon'

/**
 * ChevronLeftIcon — Navigate to previous day.
 * Used in: TimelineView date navigation.
 */
export const ChevronLeftIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
)
ChevronLeftIcon.displayName = 'ChevronLeftIcon'

/**
 * ChevronRightIcon — Navigate to next day.
 * Used in: TimelineView date navigation.
 */
export const ChevronRightIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
)
ChevronRightIcon.displayName = 'ChevronRightIcon'

// ---------------------------------------------------------------------------
// Notification / Status Icons
// ---------------------------------------------------------------------------

/**
 * CheckIcon — Success notification, "Done" status tag (stroke variant).
 * Used in: App.tsx NotifIcon success type.
 */
export const CheckIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
)
CheckIcon.displayName = 'CheckIcon'

/**
 * WarningIcon — Warning / caution triangle with exclamation mark.
 * Used in: App.tsx NotifIcon warning type, SummaryView refill alerts.
 */
export const WarningIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
)
WarningIcon.displayName = 'WarningIcon'

/**
 * AlertCircleIcon — Error / info circle with exclamation mark.
 * Used in: App.tsx NotifIcon error type, TimelineView ErrorState,
 *          CareView emergency section warning, CareView EmergencyTab info box.
 */
export const AlertCircleIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
)
AlertCircleIcon.displayName = 'AlertCircleIcon'

/**
 * CalendarGroupIcon — Notification day-group header. Calendar with date lines.
 * Identical shape to CalendarIcon — aliased here for semantic clarity at call sites.
 * Used in: App.tsx NotificationsPanel day group header.
 */
export const CalendarGroupIcon = CalendarIcon
// Note: displayName inherited from CalendarIcon

// ---------------------------------------------------------------------------
// Action / Utility Icons
// ---------------------------------------------------------------------------

/**
 * XIcon — Close / dismiss. Two crossing diagonal lines.
 * Used in: Modal.tsx close button, SummaryView dismiss insight card button.
 */
export const XIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
)
XIcon.displayName = 'XIcon'

/**
 * PlusIcon — Add / create action. Vertical and horizontal lines forming a cross.
 * Used in: RemindersPanel new reminder button, MedsView add medication buttons,
 *          SummaryView add note button, CareView add provider/caregiver/contact buttons.
 */
export const PlusIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
)
PlusIcon.displayName = 'PlusIcon'

/**
 * TrashIcon — Delete action. Bin with lid and body.
 * Used in: SummaryView delete note button, CareView DeleteButton component.
 */
export const TrashIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
)
TrashIcon.displayName = 'TrashIcon'

/**
 * PenIcon — Edit action. Pencil / pen writing shape.
 * Used in: SummaryView edit note button.
 */
export const PenIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
)
PenIcon.displayName = 'PenIcon'

// ---------------------------------------------------------------------------
// Contact / Communication Icons
// ---------------------------------------------------------------------------

/**
 * PhoneIcon — Phone call action. Handset shape.
 * Used in: CareView provider phone link, CareView emergency contact call button.
 */
export const PhoneIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 14 19.79 19.79 0 0 1 1.61 5.38 2 2 0 0 1 3.58 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17.92z" />
    </svg>
  ),
)
PhoneIcon.displayName = 'PhoneIcon'

/**
 * MailIcon — Email action. Envelope with fold-line.
 * Used in: CareView provider email link.
 */
export const MailIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
)
MailIcon.displayName = 'MailIcon'

// ---------------------------------------------------------------------------
// Empty State / Illustration Icons
// ---------------------------------------------------------------------------

/**
 * RectPlusIcon — Timeline empty state. Rectangle with a plus sign inside.
 * Used in: TimelineView EmptyState (no doses today).
 */
export const RectPlusIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
)
RectPlusIcon.displayName = 'RectPlusIcon'

/**
 * PillEmptyIcon — MedsView empty state. Oval pill body with dividing line.
 * Used in: MedsView empty state when no medications exist.
 */
export const PillEmptyIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M12 2a4 4 0 0 1 4 4v12a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
)
PillEmptyIcon.displayName = 'PillEmptyIcon'

/**
 * ClipboardIcon — Notes / doctor notes empty state. Clipboard with lined content.
 * Used in: SummaryView notes empty state.
 */
export const ClipboardIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
)
ClipboardIcon.displayName = 'ClipboardIcon'

/**
 * ActivityIcon — Healthcare / providers empty state. EKG / vitals pulse line.
 * Used in: CareView EmptyProviders state.
 */
export const ActivityIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, strokeWidth = 2, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
)
ActivityIcon.displayName = 'ActivityIcon'

// ---------------------------------------------------------------------------
// Filled / Solid Status Icons (used in TimelineView tags)
// ---------------------------------------------------------------------------

/**
 * CheckFilledIcon — "Done" status tag. Solid checkmark in a circle (filled).
 * Uses fill="currentColor" instead of stroke. viewBox 0 0 20 20.
 * Used in: TimelineView Done tag icon.
 */
export const CheckFilledIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  ),
)
CheckFilledIcon.displayName = 'CheckFilledIcon'

/**
 * ClockFilledIcon — "Late" status tag. Clock face in a circle (filled).
 * Uses fill="currentColor" instead of stroke. viewBox 0 0 20 20.
 * Used in: TimelineView Late tag icon.
 */
export const ClockFilledIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    </svg>
  ),
)
ClockFilledIcon.displayName = 'ClockFilledIcon'

/**
 * XCircleFilledIcon — "Missed" status tag. X mark in a circle (filled).
 * Uses fill="currentColor" instead of stroke. viewBox 0 0 20 20.
 * Used in: TimelineView Missed tag icon.
 */
export const XCircleFilledIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ size = 20, title, 'aria-hidden': ariaHidden = true, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden={ariaHidden}
      {...props}
    >
      <SvgTitle title={title} />
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  ),
)
XCircleFilledIcon.displayName = 'XCircleFilledIcon'

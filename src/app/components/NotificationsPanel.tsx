/**
 * NotificationsPanel — modal panel displaying grouped, collapsible notification history.
 * Owns the NotificationItem type, notifDayLabel helper, and NotifIcon helper.
 */
import React, { useMemo, useState } from 'react'
import { useNotifications } from '@/shared/hooks/useNotifications'
import { Modal } from '@/shared/components/Modal'
import {
  AlertCircleIcon, WarningIcon, CheckIcon, BellIcon,
  CalendarGroupIcon, ChevronDownIcon,
} from '@/shared/components/icons'

export type NotificationItem = {
  id: string
  type: string
  msg: string
  sub: string
  rawDate: Date
  read?: boolean
}

function notifDayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function NotifIcon({ type }: { type: string }) {
  const color =
    type === 'error'   ? 'var(--color-red)'    :
    type === 'warning' ? '#f59e0b'              :
    'var(--color-accent)'
  const bg =
    type === 'error'   ? 'color-mix(in srgb, var(--color-red) 12%, transparent)'   :
    type === 'warning' ? 'color-mix(in srgb, #f59e0b 12%, transparent)'             :
    'color-mix(in srgb, var(--color-accent) 12%, transparent)'
  const Icon =
    type === 'error'   ? AlertCircleIcon :
    type === 'warning' ? WarningIcon     :
    type === 'success' ? CheckIcon       :
    BellIcon
  return (
    <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center" style={{ background: bg, color }}>
      <Icon size={18} strokeWidth={2.2} />
    </div>
  )
}

export function NotificationsPanel({ onClose, triggerRef }: { onClose: () => void; triggerRef?: React.RefObject<HTMLButtonElement | null> }) {
  const { notifications, isLoading, markRead } = useNotifications()

  const notifs: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    msg: n.title,
    sub: n.message,
    rawDate: new Date(n.created_at),
    read: n.read,
  }))

  const groups = useMemo(() => {
    const grps: { label: string; items: NotificationItem[] }[] = []
    const seen = new Map<string, number>()
    for (const n of notifs) {
      const label = notifDayLabel(n.rawDate)
      if (!seen.has(label)) { seen.set(label, grps.length); grps.push({ label, items: [] }) }
      grps[seen.get(label)!].items.push(n)
    }
    return grps
  }, [notifs])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const defaultExpandedLabel = useMemo(() => {
    if (isLoading || groups.length === 0) return 'Today'
    const todayGroup = groups.find((g) => g.label === 'Today')
    if (todayGroup?.items.length) return 'Today'
    return groups.find((g) => g.items.some((i) => !i.read))?.label ?? 'Today'
  }, [groups, isLoading])

  const activeExpanded = useMemo(() => {
    if (expanded.size > 0) return expanded
    return new Set([defaultExpandedLabel])
  }, [defaultExpandedLabel, expanded])

  const toggle = (label: string) =>
    setExpanded((prev) => {
      const next = prev.size > 0 ? new Set(prev) : new Set([defaultExpandedLabel])
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  const totalUnread = notifs.filter((n) => !n.read).length

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Notifications" variant="center" triggerRef={triggerRef}>
      <div className="-mt-1">
        {/* Unread summary pill */}
        {totalUnread > 0 && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
            <span className="text-[14px] font-semibold text-[var(--color-accent)]">{totalUnread} unread</span>
          </div>
        )}

        {isLoading && (
          <div className="text-[var(--color-text-secondary)] py-6 text-center text-[15px]">Loading...</div>
        )}
        {!isLoading && notifs.length === 0 && (
          <div className="py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mx-auto mb-3 text-[var(--color-text-tertiary)]">
              <BellIcon size={24} strokeWidth={2} />
            </div>
            <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">All caught up</p>
            <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">No notifications yet</p>
          </div>
        )}

        {groups.map((group, gi) => {
          const isCollapsed = !activeExpanded.has(group.label)
          const unread = group.items.filter((i) => !i.read).length
          return (
            <div key={group.label} className={gi > 0 ? 'mt-3' : ''}>
              {/* Day card header */}
              <button
                type="button"
                onClick={() => toggle(group.label)}
                className="w-full border-none cursor-pointer text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded-2xl active:scale-[0.98] transition-transform"
                style={{
                  background: isCollapsed
                    ? 'var(--color-bg-secondary)'
                    : 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-secondary))',
                  borderBottom: !isCollapsed ? '1px solid color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'none',
                  borderRadius: isCollapsed ? '1rem' : '1rem 1rem 0 0',
                }}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
                      style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}
                    >
                      <CalendarGroupIcon size={18} strokeWidth={2} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[17px] font-bold text-[var(--color-text-primary)] leading-tight">{group.label}</div>
                      <div className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">
                        {group.items.length} notification{group.items.length !== 1 ? 's' : ''}
                        {unread > 0 && <span className="text-[var(--color-accent)] font-semibold"> · {unread} unread</span>}
                      </div>
                    </div>
                  </div>
                  <ChevronDownIcon
                    size={20}
                    strokeWidth={2.5}
                    className={`text-[var(--color-text-tertiary)] transition-transform duration-200 shrink-0 ${isCollapsed ? '' : 'rotate-180'}`}
                  />
                </div>
              </button>

              {!isCollapsed && (
                <div
                  className="rounded-b-2xl overflow-hidden mb-1"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 4%, var(--color-bg-secondary))' }}
                >
                  <ul className="flex flex-col divide-y divide-[var(--color-border-secondary)]">
                    {group.items.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => { if (!n.read) markRead(n.id) }}
                          className="w-full bg-transparent border-none text-left cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] active:bg-[var(--color-bg-primary)] transition-colors"
                        >
                          <div className="flex gap-4 px-4 py-4 items-start">
                            <NotifIcon type={n.type} />
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className={`text-[15px] leading-snug ${n.read ? 'font-medium text-[var(--color-text-secondary)]' : 'font-semibold text-[var(--color-text-primary)]'}`}>
                                {n.msg}
                              </div>
                              {n.sub && (
                                <div className="text-[14px] text-[var(--color-text-secondary)] mt-1 leading-snug">{n.sub}</div>
                              )}
                              <div className="text-[12px] text-[var(--color-text-tertiary)] mt-2 font-medium">
                                {n.rawDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </div>
                            </div>
                            {!n.read && (
                              <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] shrink-0 mt-2" aria-hidden />
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

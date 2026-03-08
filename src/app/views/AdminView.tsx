import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'
import { AuditService } from '@/shared/services/audit'
import { env } from '@/shared/lib/env'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui'
import {
  useAdminOverviewStats,
  useAdminFeedback,
  useAdminUserList,
  useAdminAIUsage,
} from '@/shared/hooks/useAdminData'
import type {
  AdminOverviewStats,
  AdminFeedbackRow,
  AdminUserRow,
  AdminAIUsageRow,
  AdminFeedbackParams,
} from '@/shared/types/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'overview' | 'feedback' | 'users' | 'ai-usage'

const PAGE_SIZE = 25
const AI_DAILY_LIMIT = 50

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Sub-components: shared
// ---------------------------------------------------------------------------

function ErrorCard({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'var(--color-red-bg)',
        borderColor: 'var(--color-red-border)',
        color: 'var(--color-red)',
        fontSize: 'var(--text-body)',
      }}
    >
      {message}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border p-8 text-center"
      style={{
        background: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border-primary)',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--text-body)',
      }}
    >
      {message}
    </div>
  )
}

function PaginationBar({
  page,
  hasMore,
  onPrev,
  onNext,
}: {
  page: number
  hasMore: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button variant="secondary" size="sm" onClick={onPrev} disabled={page === 0}>
        ← Prev
      </Button>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-caption)' }}>
        Page {page + 1}
      </span>
      <Button variant="secondary" size="sm" onClick={onNext} disabled={!hasMore}>
        Next →
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 1: Overview
// ---------------------------------------------------------------------------

function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-xl p-4 min-h-[80px]"
      style={{
        background: 'var(--color-amber-bg)',
        border: '1px solid var(--color-amber-border)',
      }}
    >
      <span
        className="font-bold leading-none tabular-nums"
        style={{
          fontSize: 'clamp(1.5rem, 4vw, 2rem)',
          color: accent ? 'var(--color-amber)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
      <span
        className="text-center leading-snug"
        style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}
      >
        {label}
      </span>
    </div>
  )
}

function SkeletonTile() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl p-4 min-h-[80px]"
      style={{
        background: 'var(--color-amber-bg)',
        border: '1px solid var(--color-amber-border)',
      }}
    >
      <div
        className="h-7 w-10 rounded-md animate-pulse"
        style={{ background: 'var(--color-skeleton)' }}
      />
      <div
        className="h-3.5 w-16 rounded-md animate-pulse"
        style={{ background: 'var(--color-skeleton)' }}
      />
    </div>
  )
}

function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3
        className="font-semibold"
        style={{ fontSize: 'var(--text-label)', color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{children}</div>
    </div>
  )
}

function OverviewTab() {
  const { stats, isLoading, isError, error } = useAdminOverviewStats()

  if (isError) {
    return <ErrorCard message={error?.message ?? 'Failed to load overview stats'} />
  }

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col gap-6">
        {[4, 3, 2, 5].map((count, gi) => (
          <div key={gi} className="flex flex-col gap-2">
            <div
              className="h-4 w-24 rounded-md animate-pulse"
              style={{ background: 'var(--color-skeleton)' }}
            />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: count }).map((_, i) => (
                <SkeletonTile key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const s: AdminOverviewStats = stats

  return (
    <div className="flex flex-col gap-6">
      <StatGroup title="Users">
        <StatTile label="Total Users" value={s.total_users} accent />
        <StatTile label="New (7d)" value={s.new_users_7d} />
        <StatTile label="New (30d)" value={s.new_users_30d} />
        <StatTile label="Push Enabled" value={s.users_with_push} />
      </StatGroup>

      <StatGroup title="AI & Consent">
        <StatTile label="AI Consent" value={s.users_with_ai_consent} />
        <StatTile label="AI Calls Today" value={s.total_ai_calls_today} />
        <StatTile label="AI Calls (7d)" value={s.total_ai_calls_7d} />
      </StatGroup>

      <StatGroup title="Plans">
        <StatTile label="Pro Users" value={s.pro_users} />
        <StatTile label="Family Users" value={s.family_users} />
      </StatGroup>

      <StatGroup title="Feedback">
        <StatTile label="Total Feedback" value={s.total_feedback_items} />
        <StatTile label="Unique Submitters" value={s.users_who_gave_feedback} />
        <StatTile label="New (7d)" value={s.feedback_7d} />
        <StatTile label="Bug Reports" value={s.bug_reports} />
        <StatTile label="Feature Requests" value={s.feature_requests} />
      </StatGroup>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2: Feedback
// ---------------------------------------------------------------------------

const FEEDBACK_TYPE_COLORS: Record<AdminFeedbackRow['type'], { bg: string; text: string; border: string }> = {
  bug: { bg: 'var(--color-red-bg)', text: 'var(--color-red)', border: 'var(--color-red-border)' },
  feature: { bg: 'var(--color-amber-bg)', text: 'var(--color-amber)', border: 'var(--color-amber-border)' },
  general: { bg: 'var(--color-bg-tertiary)', text: 'var(--color-text-secondary)', border: 'var(--color-border-primary)' },
}

function FeedbackTypeBadge({ type }: { type: AdminFeedbackRow['type'] }) {
  const colors = FEEDBACK_TYPE_COLORS[type]
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-medium capitalize"
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        fontSize: 'var(--text-caption)',
      }}
    >
      {type}
    </span>
  )
}

function FeedbackRow({ row }: { row: AdminFeedbackRow }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border p-4"
      style={{
        background: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border-primary)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FeedbackTypeBadge type={row.type} />
        <span
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}
        >
          {formatDate(row.created_at)}
        </span>
        {row.current_route && (
          <span
            className="font-mono"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}
          >
            {row.current_route}
          </span>
        )}
        <span
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}
        >
          v{row.app_version}
        </span>
      </div>
      <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)' }}>
        {row.message}
      </p>
    </div>
  )
}

function FeedbackTab() {
  const [filterType, setFilterType] = useState<AdminFeedbackParams['type']>(null)
  const [since, setSince] = useState<string>('')
  const [page, setPage] = useState(0)

  const params: AdminFeedbackParams = {
    type: filterType,
    since: since || null,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }

  const { feedback, isLoading, isError, error } = useAdminFeedback(params)

  function handleTypeChange(value: string) {
    const next = (value === 'all' ? null : value) as AdminFeedbackParams['type']
    setFilterType(next)
    setPage(0)
    AuditService.logAsync({
      action: 'admin.feedback_filtered',
      entity_type: 'admin_panel',
      metadata: { type: value },
    })
  }

  function handleSinceChange(value: string) {
    setSince(value)
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="feedback-type-filter"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}
          >
            Type
          </label>
          <select
            id="feedback-type-filter"
            value={filterType ?? 'all'}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="rounded-lg border px-3 py-1.5"
            style={{
              background: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-body)',
            }}
          >
            <option value="all">All</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
            <option value="general">General</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="feedback-since-filter"
            style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}
          >
            Since
          </label>
          <input
            id="feedback-since-filter"
            type="date"
            value={since}
            onChange={(e) => handleSinceChange(e.target.value)}
            className="rounded-lg border px-3 py-1.5"
            style={{
              background: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-body)',
            }}
          />
        </div>
      </div>

      {/* Content */}
      {isError && <ErrorCard message={error?.message ?? 'Failed to load feedback'} />}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl animate-pulse"
              style={{ background: 'var(--color-skeleton)' }}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && feedback.length === 0 && (
        <EmptyState message="No feedback found" />
      )}

      {!isLoading && !isError && feedback.length > 0 && (
        <div className="flex flex-col gap-3">
          {feedback.map((row) => (
            <FeedbackRow key={row.id} row={row} />
          ))}
        </div>
      )}

      {!isLoading && !isError && (
        <PaginationBar
          page={page}
          hasMore={feedback.length === PAGE_SIZE}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 3: Users
// ---------------------------------------------------------------------------

const PLAN_COLORS: Record<AdminUserRow['plan'], { bg: string; text: string; border: string }> = {
  free: { bg: 'var(--color-bg-tertiary)', text: 'var(--color-text-secondary)', border: 'var(--color-border-primary)' },
  pro: { bg: 'var(--color-amber-bg)', text: 'var(--color-amber)', border: 'var(--color-amber-border)' },
  family: { bg: 'var(--color-green-bg)', text: 'var(--color-green)', border: 'var(--color-border-primary)' },
}

function PlanBadge({ plan }: { plan: AdminUserRow['plan'] }) {
  const colors = PLAN_COLORS[plan]
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-medium capitalize"
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        fontSize: 'var(--text-caption)',
      }}
    >
      {plan}
    </span>
  )
}

function UserRow({ row }: { row: AdminUserRow }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border p-4"
      style={{
        background: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border-primary)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="font-medium"
          style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)' }}
        >
          {row.email}
        </span>
        {row.name && (
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
            ({row.name})
          </span>
        )}
        <PlanBadge plan={row.plan} />
        {row.ai_consent_granted && (
          <span
            className="inline-block rounded-full px-2 py-0.5 font-medium"
            style={{
              background: 'var(--color-green-bg)',
              color: 'var(--color-green)',
              border: '1px solid var(--color-border-primary)',
              fontSize: 'var(--text-caption)',
            }}
          >
            AI ✓
          </span>
        )}
      </div>
      <div
        className="flex flex-wrap gap-4"
        style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}
      >
        <span>Joined: {formatDate(row.joined_at)}</span>
        <span>Feedback: {row.feedback_count}</span>
        <span>AI calls today: {row.ai_calls_today}</span>
        <span>Audit actions: {row.audit_actions_total}</span>
      </div>
    </div>
  )
}

function UsersTab() {
  const [page, setPage] = useState(0)

  const { users, isLoading, isError, error } = useAdminUserList({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })

  return (
    <div className="flex flex-col gap-4">
      {isError && <ErrorCard message={error?.message ?? 'Failed to load users'} />}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl animate-pulse"
              style={{ background: 'var(--color-skeleton)' }}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && users.length === 0 && (
        <EmptyState message="No users found" />
      )}

      {!isLoading && !isError && users.length > 0 && (
        <div className="flex flex-col gap-3">
          {users.map((row) => (
            <UserRow key={row.user_id} row={row} />
          ))}
        </div>
      )}

      {!isLoading && !isError && (
        <PaginationBar
          page={page}
          hasMore={users.length === PAGE_SIZE}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 4: AI Usage
// ---------------------------------------------------------------------------

function AIUsageRow({ row }: { row: AdminAIUsageRow }) {
  const pct = Math.min(100, Math.round((row.request_count / AI_DAILY_LIMIT) * 100))

  let barColor: string
  let textColor: string
  if (row.at_limit) {
    barColor = 'var(--color-red)'
    textColor = 'var(--color-red)'
  } else if (row.near_limit) {
    barColor = 'var(--color-amber)'
    textColor = 'var(--color-amber)'
  } else {
    barColor = 'var(--color-green)'
    textColor = 'var(--color-green)'
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border p-4"
      style={{
        background: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border-primary)',
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className="font-medium"
          style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)' }}
        >
          {row.email}
        </span>
        <span className="font-bold tabular-nums" style={{ fontSize: 'var(--text-body)', color: textColor }}>
          {row.request_count} / {AI_DAILY_LIMIT}
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: '6px', background: 'var(--color-bg-tertiary)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  )
}

function AIUsageTab() {
  const [date, setDate] = useState<string>(todayIso())

  const { usage, isLoading, isError, error } = useAdminAIUsage({ date })

  function handleDateChange(value: string) {
    setDate(value)
    AuditService.logAsync({
      action: 'admin.ai_date_changed',
      entity_type: 'admin_panel',
      metadata: { date: value },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Date picker */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="ai-usage-date"
          style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}
        >
          Date
        </label>
        <input
          id="ai-usage-date"
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="rounded-lg border px-3 py-1.5 w-fit"
          style={{
            background: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-primary)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-body)',
          }}
        />
      </div>

      {/* Content */}
      {isError && <ErrorCard message={error?.message ?? 'Failed to load AI usage'} />}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl animate-pulse"
              style={{ background: 'var(--color-skeleton)' }}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && usage.length === 0 && (
        <EmptyState message="No AI usage for this date" />
      )}

      {!isLoading && !isError && usage.length > 0 && (
        <div className="flex flex-col gap-3">
          {usage.map((row) => (
            <AIUsageRow key={row.user_id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'users', label: 'Users' },
  { id: 'ai-usage', label: 'AI Usage' },
]

export function AdminView() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const isAdmin = user?.id === env.adminUserId

  // Audit: panel opened
  useEffect(() => {
    if (!isAdmin) return
    AuditService.logAsync({ action: 'admin.panel_opened', entity_type: 'admin_panel' })
  }, [isAdmin])

  // Audit: tab viewed
  useEffect(() => {
    if (!isAdmin) return
    AuditService.logAsync({
      action: 'admin.tab_viewed',
      entity_type: 'admin_panel',
      metadata: { tab: activeTab },
    })
  }, [activeTab, isAdmin])

  // Access denied
  if (!isAdmin) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-6"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        <div
          className="rounded-xl border p-8 text-center max-w-sm w-full flex flex-col gap-4"
          style={{
            background: 'var(--color-red-bg)',
            borderColor: 'var(--color-red-border)',
          }}
        >
          <h1
            className="font-bold"
            style={{ fontSize: 'var(--text-heading)', color: 'var(--color-red)' }}
          >
            Access Denied
          </h1>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-secondary)' }}>
            You do not have permission to view this page.
          </p>
          <Button variant="secondary" size="md" onClick={() => navigate('/profile')}>
            ← Back to Profile
          </Button>
        </div>
      </div>
    )
  }

  function handleTabClick(tab: Tab) {
    setActiveTab(tab)
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Sticky header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-3 border-b"
        style={{
          background: 'var(--color-bg-primary)',
          borderColor: 'var(--color-amber-border)',
          borderBottomWidth: '2px',
        }}
      >
        <h1
          className="font-bold"
          style={{ fontSize: 'var(--text-heading)', color: 'var(--color-amber)' }}
        >
          MarinLoop Admin
        </h1>
        <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
          ← Profile
        </Button>
      </header>

      {/* Tab bar */}
      <div
        className="sticky top-[57px] z-10 flex border-b overflow-x-auto"
        style={{
          background: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)',
        }}
      >
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className={cn(
              'flex-shrink-0 px-4 py-3 font-medium transition-colors border-b-2',
              activeTab === id ? 'border-[var(--color-accent)]' : 'border-transparent',
            )}
            style={{
              fontSize: 'var(--text-body)',
              color: activeTab === id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <main className="flex-1 px-4 py-6 max-w-3xl w-full mx-auto">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'feedback' && <FeedbackTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'ai-usage' && <AIUsageTab />}
      </main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

type Summary = {
  total_users: number
  new_users_7d: number
  users_with_push: number
  users_who_gave_feedback: number
  total_feedback_items: number
  bug_reports: number
  feature_requests: number
}

type Tile = { label: string; value: number; accent?: boolean }

function StatTile({ label, value, accent }: Tile) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl p-4 bg-[var(--color-amber-bg)] border border-[var(--color-amber-border)] min-h-[80px]">
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
        className="text-center leading-snug text-[var(--color-text-tertiary)]"
        style={{ fontSize: 'var(--text-caption)' }}
      >
        {label}
      </span>
    </div>
  )
}

function SkeletonTile() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl p-4 bg-[var(--color-amber-bg)] border border-[var(--color-amber-border)] min-h-[80px]">
      <div className="h-7 w-10 rounded-md bg-[var(--color-skeleton)] animate-pulse" />
      <div className="h-3.5 w-16 rounded-md bg-[var(--color-skeleton)] animate-pulse" />
    </div>
  )
}

export function AdminBetaStats() {
  const [stats, setStats] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .rpc('get_beta_admin_stats')
      .single()
      .then(({ data }: { data: unknown }) => {
        setStats(data as unknown as Summary)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} />)}
      </div>
    )
  }

  if (!stats) return null

  const tiles: Tile[] = [
    { label: 'Total users',      value: stats.total_users ?? 0,             accent: true },
    { label: 'New this week',    value: stats.new_users_7d ?? 0 },
    { label: 'Push enabled',     value: stats.users_with_push ?? 0 },
    { label: 'Gave feedback',    value: stats.users_who_gave_feedback ?? 0 },
    { label: 'Bug reports',      value: stats.bug_reports ?? 0 },
    { label: 'Feature requests', value: stats.feature_requests ?? 0 },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((tile) => <StatTile key={tile.label} {...tile} />)}
    </div>
  )
}

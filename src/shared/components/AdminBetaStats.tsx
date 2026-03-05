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

export function AdminBetaStats() {
  const [stats, setStats] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .rpc('get_beta_admin_stats')
      .single()
      .then(({ data }: { data: unknown }) => {
        setStats(data as unknown as Summary)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p className="text-[var(--color-text-tertiary)] [font-size:var(--text-body)]">Loading stats...</p>
  }
  if (!stats) return null

  const tiles: [string, number][] = [
    ['Total users', stats.total_users ?? 0],
    ['New (7d)', stats.new_users_7d ?? 0],
    ['Push enabled', stats.users_with_push ?? 0],
    ['Gave feedback', stats.users_who_gave_feedback ?? 0],
    ['Bug reports', stats.bug_reports ?? 0],
    ['Feature requests', stats.feature_requests ?? 0],
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map(([label, value]) => (
        <div key={label} className="bg-[var(--color-bg-secondary)] rounded-xl p-3">
          <div className="text-[var(--color-text-tertiary)] [font-size:var(--text-caption)] mb-0.5">{label}</div>
          <div className="font-bold text-[var(--color-text-primary)] [font-size:var(--text-subtitle)]">{value}</div>
        </div>
      ))}
    </div>
  )
}

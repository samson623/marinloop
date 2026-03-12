import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useSubscription } from '@/shared/hooks/useSubscription'
import type { ManagedProfile } from '@/shared/types/managed-profile'

export function ProfileSwitcher() {
  const { tier } = useSubscription()
  const managedProfiles = useAuthStore((s) => (s as unknown as { managedProfiles: ManagedProfile[] }).managedProfiles ?? [])
  const activeProfileId = useAuthStore((s) => (s as unknown as { activeProfileId: string | null }).activeProfileId ?? null)
  const setActiveProfile = useAuthStore((s) => (s as unknown as { setActiveProfile: (id: string | null) => void }).setActiveProfile ?? (() => {}))
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (tier !== 'pro') return null

  const activeProfile = managedProfiles.find((p) => p.id === activeProfileId) ?? null
  const displayInitial = activeProfileId === null
    ? 'Y'
    : (activeProfile?.name?.[0] ?? '?').toUpperCase()
  const displayName = activeProfileId === null
    ? 'You'
    : (activeProfile?.name ?? 'Profile').slice(0, 8)

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Switch profile"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full min-h-[44px] min-w-[44px] border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-primary)] transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        <span
          aria-hidden
          className="w-6 h-6 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-[11px] font-bold flex items-center justify-center shrink-0"
        >
          {displayInitial}
        </span>
        <span className="text-[12px] font-semibold text-[var(--color-text-primary)] max-w-[64px] truncate pr-0.5">
          {displayName}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select profile"
          className="absolute top-full right-0 mt-1 bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)] rounded-xl shadow-[var(--shadow-elevated)] z-[200] min-w-[160px] overflow-hidden"
        >
          <div
            role="option"
            aria-selected={activeProfileId === null}
            onClick={() => { setActiveProfile(null); setOpen(false) }}
            className={`px-3.5 py-2.5 text-[13px] font-medium cursor-pointer flex items-center gap-2 hover:bg-[var(--color-bg-secondary)] ${
              activeProfileId === null
                ? 'text-[var(--color-accent)] font-semibold'
                : 'text-[var(--color-text-primary)]'
            }`}
          >
            <span
              aria-hidden
              className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-[10px] font-bold flex items-center justify-center shrink-0"
            >
              Y
            </span>
            You
          </div>

          {managedProfiles.map((p) => (
            <div
              key={p.id}
              role="option"
              aria-selected={activeProfileId === p.id}
              onClick={() => { setActiveProfile(p.id); setOpen(false) }}
              className={`px-3.5 py-2.5 text-[13px] font-medium cursor-pointer flex items-center gap-2 hover:bg-[var(--color-bg-secondary)] ${
                activeProfileId === p.id
                  ? 'text-[var(--color-accent)] font-semibold'
                  : 'text-[var(--color-text-primary)]'
              }`}
            >
              <span
                aria-hidden
                className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-[10px] font-bold flex items-center justify-center shrink-0"
              >
                {(p.name?.[0] ?? '?').toUpperCase()}
              </span>
              <span className="truncate">{p.name}</span>
              {p.relationship && (
                <span className="text-[11px] text-[var(--color-text-tertiary)] ml-auto shrink-0">{p.relationship}</span>
              )}
            </div>
          ))}

          <div
            role="option"
            aria-selected={false}
            onClick={() => { navigate('/profile'); setOpen(false) }}
            className="px-3.5 py-2 text-[12px] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] border-t border-[var(--color-border-primary)] cursor-pointer"
          >
            Manage profiles →
          </div>
        </div>
      )}
    </div>
  )
}

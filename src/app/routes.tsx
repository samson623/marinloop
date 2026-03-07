/**
 * routes — auth initialization, service worker registration, and the full React Router
 * route tree. Exports AppInner (the router root) and PageLoader (Suspense fallback).
 */
import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'
import { PrivateRoute } from '@/app/PrivateRoute'
import { TimelineView } from '@/app/views/TimelineView'
import { LandingScreen } from '@/app/LandingScreen'
import { LoginScreen } from '@/app/LoginScreen'
import { AuthCallbackScreen } from '@/app/AuthCallbackScreen'
import { AppShell } from '@/app/AppShell'

// Non-critical routes — code-split to reduce initial bundle
const MedsView = React.lazy(() => import('@/app/views/MedsView').then((m) => ({ default: m.MedsView })))
const ApptsView = React.lazy(() => import('@/app/views/ApptsView').then((m) => ({ default: m.ApptsView })))
const SummaryView = React.lazy(() => import('@/app/views/SummaryView').then((m) => ({ default: m.SummaryView })))
const ProfileView = React.lazy(() => import('@/app/views/ProfileView').then((m) => ({ default: m.ProfileView })))
const CareView = React.lazy(() => import('@/app/views/CareView').then((m) => ({ default: m.CareView })))
const InstallGuideScreen = React.lazy(() => import('@/app/InstallGuideScreen').then((m) => ({ default: m.InstallGuideScreen })))
const PrivacyPolicyView = React.lazy(() => import('@/app/views/PrivacyPolicyView').then((m) => ({ default: m.PrivacyPolicyView })))
const TermsView = React.lazy(() => import('@/app/views/TermsView').then((m) => ({ default: m.TermsView })))
const IceCardScreen = React.lazy(() => import('@/app/views/IceCardScreen').then((m) => ({ default: m.IceCardScreen })))

export function PageLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-screen bg-[var(--color-bg-primary)]"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
        <p className="text-[var(--color-text-tertiary)] text-sm">Loading…</p>
      </div>
    </div>
  )
}

export function AppInner() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { })
    }
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/timeline" replace />} />
      <Route path="/landing" element={<LandingScreen />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/auth/callback" element={<AuthCallbackScreen />} />
      <Route path="/install" element={<React.Suspense fallback={<PageLoader />}><InstallGuideScreen /></React.Suspense>} />
      <Route path="/privacy" element={<React.Suspense fallback={<PageLoader />}><PrivacyPolicyView /></React.Suspense>} />
      <Route path="/terms" element={<React.Suspense fallback={<PageLoader />}><TermsView /></React.Suspense>} />
      <Route path="/ice" element={<React.Suspense fallback={<PageLoader />}><IceCardScreen /></React.Suspense>} />
      <Route element={<PrivateRoute />}>
        <Route element={<AppShell />}>
          <Route path="/timeline" element={<TimelineView />} />
          <Route path="/meds" element={<React.Suspense fallback={<PageLoader />}><MedsView /></React.Suspense>} />
          <Route path="/appts" element={<React.Suspense fallback={<PageLoader />}><ApptsView /></React.Suspense>} />
          <Route path="/summary" element={<React.Suspense fallback={<PageLoader />}><SummaryView /></React.Suspense>} />
          <Route path="/care" element={<React.Suspense fallback={<PageLoader />}><CareView /></React.Suspense>} />
          <Route path="/profile" element={<React.Suspense fallback={<PageLoader />}><ProfileView /></React.Suspense>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/timeline" replace />} />
    </Routes>
  )
}

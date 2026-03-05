import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'

export function PrivateRoute() {
  const { session, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg-primary)]">
        Loading...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/landing" replace />
  }

  return <Outlet />
}

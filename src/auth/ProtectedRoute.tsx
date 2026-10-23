import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'

export function AuthLoading() {
  return (
    <main className="auth-state page-shell" aria-live="polite">
      <p className="eyebrow">SpeakDaily</p>
      <p>Restoring your session…</p>
    </main>
  )
}

export function AuthConfigurationNotice() {
  return (
    <main className="auth-state page-shell">
      <p className="eyebrow">Setup needed</p>
      <h1>Connect SpeakDaily to Supabase.</h1>
      <p>Copy <code>.env.example</code> to <code>.env</code>, set your project URL and publishable key, then restart the development server.</p>
    </main>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, session, sessionExpired, configurationError } = useAuth()
  const location = useLocation()

  if (configurationError) return <AuthConfigurationNotice />
  if (loading) return <AuthLoading />
  if (!session) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: location.pathname, reason: sessionExpired ? 'expired' : 'required' }}
      />
    )
  }
  return children
}

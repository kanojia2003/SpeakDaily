import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthConfigurationNotice } from './ProtectedRoute'
import { useAuth } from './AuthContext'

type AuthPageProps = { mode: 'signin' | 'signup' }
type LocationState = { from?: string; reason?: string; message?: string }

function readableAuthError(error: unknown, mode: AuthPageProps['mode']): string {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('invalid login credentials') || message.includes('invalid email or password')) {
    return 'That email and password do not match. Check them and try again.'
  }
  if (message.includes('already registered') || message.includes('already exists') || message.includes('user already')) {
    return 'An account with this email already exists. Sign in instead.'
  }
  if (message.includes('email not confirmed') || message.includes('email is not confirmed')) {
    return 'Please confirm your email using the link we sent, then sign in.'
  }
  if (message.includes('expired') || message.includes('refresh token')) {
    return 'Your session has expired. Please sign in again.'
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'There have been too many attempts. Wait a little while and try again.'
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'We could not reach Supabase. Check your connection and try again.'
  }
  if (message) return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
  return mode === 'signup' ? 'Your account could not be created. Please try again.' : 'You could not be signed in. Please try again.'
}

export function AuthPage({ mode }: AuthPageProps) {
  const isSignup = mode === 'signup'
  const { client, configurationError, session, loading, clearSessionExpired } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const locationState = location.state as LocationState | null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (loading) return <main className="auth-state page-shell" aria-live="polite"><p>Restoring your session…</p></main>
  if (session) return <Navigate to="/app" replace />
  if (configurationError || !client) return <AuthConfigurationNotice />
  const supabase = client

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setError('Enter your email address and password to continue.')
      return
    }
    if (isSignup && password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    setBusy(true)
    try {
      if (isSignup) {
        const redirectTo = new URL('/signin?confirmed=1', window.location.origin).toString()
        const { data, error: signupError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: displayName.trim() ? { display_name: displayName.trim() } : {},
          },
        })
        if (signupError) throw signupError
        if (data.session) {
          clearSessionExpired()
          navigate('/app', { replace: true })
          return
        }
        setNotice(data.user?.identities?.length === 0
          ? 'If an account can be created for this email, you will receive a confirmation message. You can also try signing in.'
          : 'Check your inbox for a confirmation link. Confirm your email, then sign in to continue.')
      } else {
        const { error: signinError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        if (signinError) throw signinError
        clearSessionExpired()
        navigate(locationState?.from?.startsWith('/app') ? locationState.from : '/app', { replace: true })
      }
    } catch (submitError) {
      setError(readableAuthError(submitError, mode))
    } finally {
      setBusy(false)
    }
  }

  const confirmed = !isSignup && searchParams.get('confirmed') === '1'
  const contextualMessage = locationState?.reason === 'expired'
    ? 'Your session expired. Sign in again to continue.'
    : locationState?.reason === 'required'
      ? 'Sign in to open your SpeakDaily space.'
      : locationState?.message

  return (
    <main className="auth-page page-shell" id="main-content">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="wordmark auth-wordmark" to="/" aria-label="SpeakDaily home">Speak<span>Daily</span></Link>
        <p className="eyebrow">{isSignup ? 'Start a small daily practice' : 'Welcome back'}</p>
        <h1 id="auth-title">{isSignup ? 'Make space for your voice.' : 'Good to have you back.'}</h1>
        <p className="auth-description">
          {isSignup ? 'Create an account to keep your speaking practice in one place.' : 'Sign in to return to your speaking practice.'}
        </p>

        {contextualMessage && <p className="form-notice" role="status">{contextualMessage}</p>}
        {confirmed && <p className="form-notice" role="status">Email confirmed. You can sign in to continue.</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="form-field">
              <span>Display name <span className="field-optional">(optional)</span></span>
              <input
                autoComplete="name"
                maxLength={80}
                name="displayName"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How should we address you?"
                value={displayName}
              />
            </label>
          )}
          <label className="form-field">
            <span>Email address</span>
            <input
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={6}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {isSignup && <span className="field-help">Use at least 6 characters.</span>}
          </label>
          {isSignup && (
            <label className="form-field">
              <span>Confirm password</span>
              <input
                autoComplete="new-password"
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
          )}
          <button className="button-link auth-submit" disabled={busy} type="submit">
            {busy ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Create account' : 'Sign in')}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? 'Already have an account?' : 'New to SpeakDaily?'}{' '}
          <Link to={isSignup ? '/signin' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link>
        </p>
        <Link className="auth-home-link" to="/">Back to SpeakDaily</Link>
      </section>
    </main>
  )
}

import { ExercisePreview } from './components/ExercisePreview'
import { LinkButton } from './components/LinkButton'
import { Section } from './components/Section'
import { SiteHeader } from './components/SiteHeader'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthPage } from './auth/AuthPage'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { useEffect, useState, type FormEvent } from 'react'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { SpeakingExercisePage } from './features/dashboard/SpeakingExercisePage'
import { SessionHistoryPage } from './features/sessions/SessionHistoryPage'
import { SessionDetailPage } from './features/sessions/SessionDetailPage'
import { PrivacyNoticePage } from './components/PrivacyNoticePage'

const steps = [
  {
    number: '01',
    title: 'Choose a prompt',
    description: 'Start with a simple question about your day, an idea, or something you care about.',
  },
  {
    number: '02',
    title: 'Say it out loud',
    description: 'Take a couple of minutes to shape your thoughts in your own words.',
  },
  {
    number: '03',
    title: 'Come back tomorrow',
    description: 'A small, regular practice makes speaking feel more familiar over time.',
  },
]

function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="hero page-shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">A little practice goes a long way</p>
            <h1 id="hero-title">Make room for <em>your voice.</em></h1>
            <p className="hero-description">Two minutes a day. Speak with more confidence.</p>
            <div className="hero-actions">
              <LinkButton href="#exercise">Try a speaking prompt <span aria-hidden="true">↗</span></LinkButton>
              <a className="text-link" href="#how-it-works">See how it works</a>
              <a className="text-link" href="/signup">Create an account</a>
            </div>
            <p className="hero-note">A calm, simple way to make speaking practice part of your day.</p>
          </div>
          <div className="hero-aside" aria-hidden="true">
            <span className="aside-rule" />
            <p>Find your words.<br />One day at a time.</p>
          </div>
        </section>

        <Section id="exercise" className="exercise-section" ariaLabelledBy="exercise-heading">
          <div className="section-heading">
            <p className="eyebrow">A sample to get started</p>
            <h2 id="exercise-heading">Your next two minutes.</h2>
          </div>
          <ExercisePreview />
        </Section>

        <Section id="how-it-works" className="steps-section" ariaLabelledBy="steps-heading">
          <div className="section-heading steps-intro">
            <p className="eyebrow">A practice that fits</p>
            <h2 id="steps-heading">Keep it simple.<br /><em>Keep showing up.</em></h2>
          </div>
          <ol className="steps-list">
            {steps.map((step) => (
              <li className="step" key={step.number}>
                <span className="step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <section className="topic-band" id="topics" aria-labelledby="topic-heading">
          <div className="page-shell topic-inner">
            <p className="eyebrow">A prompt for today</p>
            <h2 id="topic-heading">Tell a story about a small thing that made your day better.</h2>
            <a href="#exercise" className="text-link">Use this prompt <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="page-shell footer-inner">
          <a className="wordmark footer-wordmark" href="#top" aria-label="SpeakDaily, back to top">Speak<span>Daily</span></a>
          <p>Two minutes a day. Speak with more confidence.</p>
          <Link className="footer-top" to="/privacy">Privacy</Link>
          <a className="footer-top" href="#top">Back to top ↑</a>
        </div>
      </footer>
    </>
  )
}

function ProfileSettings() {
  const { profile, profileState, profileError, updateDisplayName, client } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (profileState === 'ready') setDisplayName(profile?.display_name ?? '')
  }, [profile, profileState])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = displayName.trim()
    if (!name) {
      setError('Enter a display name to save.')
      setSaved(false)
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateDisplayName(name)
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Your profile could not be updated. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (!client || deleting) return
    const confirmed = window.confirm('Permanently delete your SpeakDaily account, saved sessions, transcripts, feedback, and private recordings? This cannot be undone.')
    if (!confirmed) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const { data, error: deletionError } = await client.functions.invoke('delete-account', {
        body: { confirm_delete: true },
      })
      if (deletionError || !data || typeof data !== 'object' || data.deleted !== true) {
        throw new Error('account_deletion_incomplete')
      }
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
      navigate('/', { replace: true })
    } catch {
      setDeleteError('We could not confirm account deletion. Some private recordings or app data may already have been removed. If you can still sign in, retrying deletion is safe.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="profile-panel" aria-labelledby="profile-heading">
      <p className="eyebrow">Your account</p>
      <h2 id="profile-heading">Profile details</h2>
      {profileState === 'loading' && <p role="status">Loading your profile…</p>}
      {profileState === 'error' && <p className="form-error" role="alert">{profileError}</p>}
      {profileState === 'ready' && (
        <form className="profile-form" onSubmit={handleSubmit}>
          <label className="form-field" htmlFor="display-name">
            <span>Display name</span>
            <input
              id="display-name"
              autoComplete="name"
              maxLength={80}
              onChange={(event) => { setDisplayName(event.target.value); setSaved(false) }}
              required
              value={displayName}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {saved && <p className="form-notice" role="status">Your display name has been updated.</p>}
          <button className="button-link" disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save display name'}
          </button>
        </form>
      )}
      <div className="account-privacy-actions">
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <p>Deleting your account removes its saved practice data and private recordings. Read the <Link to="/privacy">privacy notice</Link> for details about provider processing and backup limits.</p>
        <button className="danger-button" disabled={deleting} onClick={() => { void handleDeleteAccount() }} type="button">
          {deleting ? 'Deleting account…' : 'Delete account'}
        </button>
      </div>
    </section>
  )
}

function AuthenticatedApp() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState<string | null>(null)

  async function handleSignOut() {
    if (!client) return
    setSignOutError(null)
    try {
      const { error } = await client.auth.signOut()
      if (error) throw error
      navigate('/signin', { replace: true, state: { message: 'You have been signed out.' } })
    } catch {
      setSignOutError('We could not sign you out. Check your connection and try again.')
    }
  }

  return (
    <div className="authenticated-layout">
      <header className="app-header">
        <div className="page-shell app-header-inner">
          <Link className="wordmark" to="/app" aria-label="SpeakDaily overview">Speak<span>Daily</span></Link>
          <nav className="app-nav" aria-label="Application navigation">
            <Link className="app-nav-current" to="/app" aria-current="page">Overview</Link>
            <Link to="/app/history">History</Link>
            <button className="signout-button" onClick={handleSignOut} type="button">Sign out</button>
          </nav>
        </div>
      </header>
      <main className="page-shell app-main" id="main-content">
        {signOutError && <p className="form-error" role="alert">{signOutError}</p>}
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="page-shell footer-inner">
          <Link className="wordmark footer-wordmark" to="/">Speak<span>Daily</span></Link>
          <p>Two minutes a day. Speak with more confidence.</p>
          <Link className="footer-top" to="/privacy">Privacy</Link>
          <Link className="footer-top" to="/">Back to home</Link>
        </div>
      </footer>
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<AuthPage mode="signin" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/privacy" element={<PrivacyNoticePage />} />
          <Route path="/app" element={<ProtectedRoute><AuthenticatedApp /></ProtectedRoute>}>
            <Route index element={<DashboardPage profileSettings={<ProfileSettings />} />} />
            <Route path="exercise/:topicId" element={<SpeakingExercisePage />} />
            <Route path="history" element={<SessionHistoryPage />} />
            <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

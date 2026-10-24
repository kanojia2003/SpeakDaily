import { ExercisePreview } from './components/ExercisePreview'
import { LinkButton } from './components/LinkButton'
import { Section } from './components/Section'
import { SiteHeader } from './components/SiteHeader'
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthPage } from './auth/AuthPage'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { useState } from 'react'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { SpeakingExercisePage } from './features/dashboard/SpeakingExercisePage'
import { SessionHistoryPage } from './features/sessions/SessionHistoryPage'
import { SessionDetailPage } from './features/sessions/SessionDetailPage'
import { PrivacyNoticePage } from './components/PrivacyNoticePage'
import { AccountSettingsPage } from './features/account/AccountSettingsPage'

const steps = [
  {
    number: '01',
    title: 'Choose a prompt',
    description: 'Choose a daily English-speaking topic and read its prompt.',
  },
  {
    number: '02',
    title: 'Say it out loud',
    description: 'Record your spoken English for up to two minutes, then listen back before submitting.',
  },
  {
    number: '03',
    title: 'Review and return',
    description: 'Get an AI-generated transcript and English-learning feedback, then revisit your saved results in practice history.',
  },
]

function LandingPage() {
  const { session } = useAuth()
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="hero page-shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">A little practice goes a long way</p>
            <h1 id="hero-title">Make room for <em>your voice.</em></h1>
            <p className="hero-description">Choose a topic, record up to two minutes of spoken English, and submit it for an AI transcript and English-learning feedback. Review your results and revisit past sessions whenever you like.</p>
            <div className="hero-actions">
              <LinkButton href={session ? '/app' : '/signup'}>{session ? 'Go to your practice' : 'Start free practice'} <span aria-hidden="true">↗</span></LinkButton>
              <a className="text-link" href="#how-it-works">See how it works</a>
              <Link className="text-link" to="/signin">Sign in</Link>
              {!session && <Link className="text-link" to="/signup">Create account</Link>}
            </div>
            <p className="hero-note">Practice at your own pace. Your recording is uploaded only when you choose to submit it.</p>
          </div>
          <div className="hero-aside" aria-hidden="true">
            <span className="aside-rule" />
            <p>Find your words.<br />One day at a time.</p>
          </div>
        </section>

        <Section id="exercise" className="exercise-section" ariaLabelledBy="exercise-heading">
          <div className="section-heading">
            <p className="eyebrow">A sample to get started</p>
            <h2 id="exercise-heading">A question to answer aloud.</h2>
            <p className="dashboard-lede">This sample prompt shows the kind of question you can practise with. In the application, record your response, review it, and submit it for transcription and English-learning feedback.</p>
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
            <h2 id="topic-heading">What is something you learned recently that surprised you?</h2>
            <a href="#exercise" className="text-link">View the sample exercise <span aria-hidden="true">↗</span></a>
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
            <NavLink end className={({ isActive }) => isActive ? 'app-nav-current' : undefined} to="/app">Overview</NavLink>
            <NavLink className={({ isActive }) => isActive ? 'app-nav-current' : undefined} to="/app/history">History</NavLink>
            <NavLink className={({ isActive }) => isActive ? 'app-nav-current' : undefined} to="/app/settings">Settings</NavLink>
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
            <Route index element={<DashboardPage />} />
            <Route path="exercise/:topicId" element={<SpeakingExercisePage />} />
            <Route path="history" element={<SessionHistoryPage />} />
            <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
            <Route path="settings" element={<AccountSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

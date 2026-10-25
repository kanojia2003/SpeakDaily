import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { fetchRecentCommunicationRuns, type CommunicationDifficulty, type CommunicationRegister, type CommunicationScenario } from './data'

const requestKeyName = (userId: string) => `speakdaily-communication-request:${userId}`

function errorCodeFrom(error: unknown) {
  const response = error && typeof error === 'object' ? (error as { context?: Response }).context : undefined
  return response ? response.clone().json().then((body: unknown) => {
    if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).error === 'string') return (body as Record<string, string>).error
    return null
  }).catch(() => null) : Promise.resolve(null)
}

function messageFor(code: string | null) {
  if (code === 'generation_quota_exceeded') return 'You have used today’s question-generation limit. Your saved lessons remain available; try again tomorrow.'
  if (code === 'provider_timeout') return 'Question generation took too long. The request was not repeated, so you can start a new set and try again.'
  if (code === 'provider_quota') return 'The question service has reached its current limit. Try again later.'
  if (code === 'generation_unavailable' || code === 'provider_unavailable') return 'Question generation is temporarily unavailable. Your lesson was not created with sample questions.'
  if (code === 'generation_failed') return 'This question set could not be generated. Start a new set to try again.'
  return 'We could not create this practice set. Check your connection and try again.'
}

export function CommunicationPracticeSetupPage() {
  const { client, session } = useAuth()
  const navigate = useNavigate()
  const [scenario, setScenario] = useState<CommunicationScenario>('everyday')
  const [register, setRegister] = useState<CommunicationRegister>('neutral')
  const [difficulty, setDifficulty] = useState<CommunicationDifficulty>('beginner')
  const [context, setContext] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentRuns, setRecentRuns] = useState<Array<{ id: string; scenario: string; register: string; difficulty: string; status: string; created_at: string }>>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState<string | null>(null)
  const [recentRevision, setRecentRevision] = useState(0)

  useEffect(() => {
    let active = true
    if (!client || !session) { setRecentLoading(false); return }
    void fetchRecentCommunicationRuns(client, session.user.id).then((rows) => {
      if (active) { setRecentRuns(rows); setRecentError(null) }
    }).catch((failure: unknown) => {
      if (active) setRecentError(failure instanceof Error ? failure.message : 'Your recent communication practices could not be loaded.')
    }).finally(() => { if (active) setRecentLoading(false) })
    return () => { active = false }
  }, [client, session, recentRevision])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    if (!client || !session) { setError('Sign in again to start communication practice.'); return }
    if (!crypto.randomUUID) { setError('This browser cannot create a secure practice ID. Update your browser and try again.'); return }
    setSubmitting(true)
    setError(null)
    const storageKey = requestKeyName(session.user.id)
    let requestKey: string
    try {
      requestKey = window.sessionStorage.getItem(storageKey) ?? crypto.randomUUID()
      window.sessionStorage.setItem(storageKey, requestKey)
    } catch {
      requestKey = crypto.randomUUID()
    }
    try {
      const { data, error: invokeError } = await client.functions.invoke('generate-communication-practice', {
        body: { request_key: requestKey, scenario, register, difficulty, context: context.trim() },
      })
      if (invokeError) {
        const code = await errorCodeFrom(invokeError)
        if (code === 'generation_failed') {
          try { window.sessionStorage.removeItem(storageKey) } catch { /* next page load can use another key */ }
        }
        throw new Error(messageFor(code))
      }
      if (!data || typeof data !== 'object' || typeof data.run_id !== 'string' || !['ready', 'generating'].includes(data.status)) {
        throw new Error('The practice service returned an incomplete response. Retry this request safely or check your saved lessons.')
      }
      if (data.status === 'ready') {
        try { window.sessionStorage.removeItem(storageKey) } catch { /* lesson is safely persisted */ }
      }
      navigate(`/app/communication/${data.run_id}`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : messageFor(null))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="communication-page communication-setup">
      <Link className="text-link exercise-back-link" to="/app">← Back to your dashboard</Link>
      <header className="communication-heading">
        <p className="eyebrow">Daily communication practice</p>
        <h1>Practise a conversation, <em>one answer at a time.</em></h1>
        <p className="dashboard-lede">Choose a situation and speaking style. Speak your answers, then review saved transcripts and English feedback for each one.</p>
      </header>
      <section className="communication-form-section" aria-labelledby="communication-form-title">
        <div>
          <p className="eyebrow">Set up today’s lesson</p>
          <h2 id="communication-form-title">What would you like to practise?</h2>
          <p className="dashboard-muted">SpeakDaily generates four questions for this lesson. Each answer can be up to two minutes and is submitted individually for analysis.</p>
        </div>
        <form className="profile-form communication-form" onSubmit={(event) => { void handleSubmit(event) }}>
          <label className="form-field">
            <span>Conversation situation</span>
            <select disabled={submitting} onChange={(event) => setScenario(event.target.value as CommunicationScenario)} value={scenario}>
              <option value="everyday">Everyday conversation</option><option value="interview">Job interview</option>
              <option value="workplace">Workplace or corporate</option><option value="presentation">Presentation</option>
              <option value="social">Friends and social situations</option><option value="travel">Travel</option>
              <option value="learning">Learning and reflection</option><option value="creative">Creative problem-solving</option>
              <option value="opinion">Opinions and discussion</option>
            </select>
          </label>
          <label className="form-field">
            <span>Speaking style</span>
            <select disabled={submitting} onChange={(event) => setRegister(event.target.value as CommunicationRegister)} value={register}>
              <option value="neutral">Neutral</option><option value="formal">Formal</option><option value="informal">Informal</option>
            </select>
          </label>
          <label className="form-field">
            <span>Difficulty</span>
            <select disabled={submitting} onChange={(event) => setDifficulty(event.target.value as CommunicationDifficulty)} value={difficulty}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="form-field">
            <span>Optional context <span className="field-optional">(avoid personal or sensitive details)</span></span>
            <textarea disabled={submitting} maxLength={300} onChange={(event) => setContext(event.target.value)} placeholder="For example: a first interview for a design role" rows={3} value={context} />
            <span className="field-help">This text is sent to Google Gemini to tailor your questions. Up to 300 characters.</span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button-link" disabled={submitting} type="submit">{submitting ? 'Creating your questions…' : 'Create today’s questions'}</button>
        </form>
      </section>
      <p className="communication-privacy-note">Your answers use SpeakDaily’s private recording and analysis flow. Recordings are uploaded only when you submit them.</p>
      <section className="communication-recent" aria-labelledby="recent-communication-title">
        <div className="dashboard-section-heading"><div><p className="eyebrow">Saved lessons</p><h2 id="recent-communication-title">Your recent communication practice.</h2></div></div>
        {recentLoading ? <p className="dashboard-loading" role="status">Loading saved lessons…</p>
          : recentError ? <div className="dashboard-error" role="alert"><p>{recentError}</p><button className="text-button" onClick={() => { setRecentLoading(true); setRecentRevision((value) => value + 1) }} type="button">Try again</button></div>
            : recentRuns.length ? <ul className="session-list">{recentRuns.map((item) => <li key={item.id}><Link className="dashboard-session-link" to={`/app/communication/${item.id}`}><span><span className="session-topic">{item.scenario} practice</span><span className="session-date">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.created_at))} · {item.difficulty} · {item.register}</span></span><span className={`session-status status-${item.status}`}>{item.status === 'ready' ? 'Resume or review' : item.status === 'generating' ? 'Preparing questions' : 'Generation failed'}</span></Link></li>)}</ul>
              : <p className="dashboard-empty">Your generated lessons will appear here after you create one.</p>}
      </section>
    </div>
  )
}

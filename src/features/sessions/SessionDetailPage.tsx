import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { EvaluationResults } from '../recording/EvaluationResults'
import { asEvaluationFeedback } from '../recording/evaluationFeedback'
import { fetchSavedSession, fetchTopicTitles, formatSessionDate, formatSessionDuration, sessionStatusLabel, type SavedSession } from './sessionData'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function SessionDetailPage() {
  const { sessionId = '' } = useParams()
  const { client, session: authSession } = useAuth()
  const userId = authSession?.user.id
  const [record, setRecord] = useState<SavedSession | null>(null)
  const [topicTitle, setTopicTitle] = useState('Topic unavailable')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [revision, setRevision] = useState(0)

  const load = useCallback(async () => {
    if (!client || !userId) { setLoading(false); setError('Sign in again to load this session.'); return }
    if (!uuidPattern.test(sessionId)) { setLoading(false); setError('This session link is not valid.'); return }
    setLoading(true); setError(null)
    try {
      const saved = await fetchSavedSession(client, userId, sessionId)
      setRecord(saved)
      if (!saved) { setError('This session could not be found in your account.'); return }
      if (saved.topic_title) setTopicTitle(saved.topic_title)
      else if (saved.topic_id) {
        try {
          const names = await fetchTopicTitles(client, [saved.topic_id])
          setTopicTitle(names.get(saved.topic_id) ?? 'Topic unavailable')
        } catch { setTopicTitle('Topic name unavailable') }
      } else setTopicTitle('Unprompted session')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'This saved session could not be loaded. Check your connection and try again.')
    } finally { setLoading(false) }
  }, [client, userId, sessionId])

  useEffect(() => { void load() }, [load, revision])

  async function continuePendingAnalysis() {
    if (!client || !record || record.status !== 'pending' || !record.recording_path || working) return
    setWorking(true); setActionError(null)
    try {
      const { error: invokeError } = await client.functions.invoke('evaluate-speaking', { body: { session_id: record.id } })
      if (invokeError) {
        const response = (invokeError as { context?: Response }).context
        const body = response ? await response.clone().json().catch(() => null) as { error?: unknown } | null : null
        if (body?.error === 'daily_quota_exceeded' || body?.error === 'quota_exceeded') throw new Error('Today’s analysis limit has been reached. Start a new recording when your limit resets.')
        if (body?.error === 'evaluation_unavailable') throw new Error('The analysis service is unavailable right now. Your saved session remains available here.')
      }
      setRevision((value) => value + 1)
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : 'Analysis could not be started. Your saved session remains unchanged.')
      setRevision((value) => value + 1)
    } finally { setWorking(false) }
  }

  const feedback = record?.status === 'completed' ? asEvaluationFeedback(record.feedback) : null

  return (
    <div className="session-page">
      <Link className="text-link session-back-link" to="/app/history">← Back to practice history</Link>
      {loading ? <p className="dashboard-loading" role="status">Loading saved results…</p>
        : error ? <div className="dashboard-error" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRevision((value) => value + 1)} type="button">Try again</button></div>
        : record ? <>
          <header className="session-page-heading">
            <p className="eyebrow">Saved speaking session</p>
            <h1>{topicTitle}</h1>
            <p>{formatSessionDate(record.created_at)} <span aria-hidden="true">·</span> {formatSessionDuration(record.duration_seconds)}</p>
            <span className={`session-status status-${record.status}`}>{sessionStatusLabel(record.status, record.recording_path)}</span>
          </header>
          {actionError && <p className="form-error" role="alert">{actionError}</p>}
          {record.status === 'pending' && <section className="session-state-panel">
            <h2>This session is waiting for analysis.</h2>
            {record.recording_path ? <><p>Your recording is saved privately. You can safely start its first analysis now.</p><button className="button-link" disabled={working} onClick={() => { void continuePendingAnalysis() }} type="button">{working ? 'Starting analysis…' : 'Analyze saved session'}</button></>
              : <p>No recording is attached to this session, so analysis cannot start. Record a new response from the dashboard.</p>}
          </section>}
          {record.status === 'processing' && <section className="session-state-panel"><h2>Analysis is in progress.</h2><p>This page reads saved session state. Refresh the status when you’re ready to check again.</p><button className="secondary-button" onClick={() => setRevision((value) => value + 1)} type="button">Refresh status</button></section>}
          {record.status === 'failed' && <section className="session-state-panel"><h2>This session could not be completed.</h2><p>{record.error_message?.includes('quota') ? 'The daily analysis limit was reached. Start a new recording after the limit resets.' : 'This analysis attempt is finished. The recording is removed after processing, and retrying could repeat a provider charge. Start a new recording to try again.'}</p></section>}
          {record.status === 'completed' && feedback ? <EvaluationResults transcript={record.transcript ?? ''} feedback={feedback} />
            : record.status === 'completed' && <p className="form-error" role="alert">Saved feedback could not be validated, so it is not displayed.</p>}
          <Link className="text-link session-dashboard-link" to="/app">{record.status === 'failed' ? 'Choose a new topic and start another session' : 'Return to your dashboard'} <span aria-hidden="true">↗</span></Link>
        </> : null}
    </div>
  )
}

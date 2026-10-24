import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { fetchSessionPage, fetchTopicTitles, formatSessionDate, formatSessionDuration, SESSION_PAGE_SIZE, sessionStatusLabel, type SavedSession } from './sessionData'

export function SessionHistoryPage() {
  const { client, session } = useAuth()
  const userId = session?.user.id
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [titles, setTitles] = useState<Map<string, string>>(new Map())
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const loadedCount = useRef(0)

  const load = useCallback(async (append: boolean) => {
    if (!client || !userId) { setError('Sign in again to load your practice history.'); setLoading(false); return }
    if (append) setLoadingMore(true)
    else { setLoading(true); setError(null) }
    try {
      const offset = append ? loadedCount.current : 0
      const page = await fetchSessionPage(client, userId, offset)
      const newTitles = await fetchTopicTitles(client, [...new Set(page.sessions.flatMap((item) => item.topic_id && !item.topic_title ? [item.topic_id] : []))])
      setSessions((current) => append ? [...current, ...page.sessions] : page.sessions)
      loadedCount.current = append ? offset + page.sessions.length : page.sessions.length
      setTitles((current) => new Map([...current, ...newTitles]))
      setTotal(page.total)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Your practice history could not be loaded. Check your connection and try again.')
    } finally { setLoading(false); setLoadingMore(false) }
  }, [client, userId])

  useEffect(() => { void load(false) }, [load, revision])

  return (
    <div className="session-page">
      <Link className="text-link session-back-link" to="/app">← Back to overview</Link>
      <header className="session-page-heading">
        <p className="eyebrow">Your saved activity</p>
        <h1>Practice history.</h1>
        <p>Each session and its saved results, all in one place.</p>
      </header>
      {error ? <div className="dashboard-error" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRevision((value) => value + 1)} type="button">Try again</button></div>
        : loading ? <p className="dashboard-loading" role="status">Loading your saved sessions…</p>
        : sessions.length === 0 ? <div className="session-empty"><p>You haven’t saved a speaking session yet.</p><Link className="button-link" to="/app">Choose a topic</Link></div>
        : <>
          <ul className="saved-session-list">
            {sessions.map((item) => <li key={item.id}>
              <Link className="saved-session-link" to={`/app/sessions/${item.id}`}>
                <span className="saved-session-copy">
                  <span className="session-topic">{item.topic_title ?? (item.topic_id ? titles.get(item.topic_id) ?? 'Topic unavailable' : 'Unprompted session')}</span>
                  <span className="session-date">{formatSessionDate(item.created_at)} <span aria-hidden="true">·</span> {formatSessionDuration(item.duration_seconds)}</span>
                </span>
                <span className={`session-status status-${item.status}`}>{sessionStatusLabel(item.status, item.recording_path)}</span>
              </Link>
            </li>)}
          </ul>
          <p className="history-count" role="status">Showing {sessions.length} of {total} sessions</p>
          {sessions.length < total && <button className="secondary-button" disabled={loadingMore} onClick={() => { void load(true) }} type="button">{loadingMore ? 'Loading…' : 'Load more sessions'}</button>}
          {sessions.length >= SESSION_PAGE_SIZE && <Link className="text-link history-top-link" to="/app">Back to overview</Link>}
        </>}
    </div>
  )
}

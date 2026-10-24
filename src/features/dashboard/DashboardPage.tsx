import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useDashboardData } from './useDashboardData'
import type { SpeakingSession, SpeakingTopic } from './data'
import { sessionStatusLabel } from '../sessions/sessionData'

function formatSessionDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function sessionTopicName(session: SpeakingSession, topics: SpeakingTopic[]) {
  if (!session.topic_id) return 'Unprompted session'
  return topics.find((topic) => topic.id === session.topic_id)?.title ?? 'Topic unavailable'
}

function TopicMeta({ topic }: { topic: SpeakingTopic }) {
  return <p className="topic-meta">{topic.difficulty} <span aria-hidden="true">·</span> {topic.category}</p>
}

export function DashboardPage() {
  const { session, profile, profileState, profileError } = useAuth()
  const { topics, topicLoading, topicError, practice, practiceLoading, practiceError, retry } = useDashboardData()
  const displayName = profile?.display_name?.trim() || session?.user.email?.split('@')[0]
  const featured = topics[0]

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <p className="eyebrow">Your SpeakDaily space</p>
        <h1>{displayName ? <>Welcome, <em>{displayName}</em>.</> : 'Welcome back.'}</h1>
        <p className="dashboard-lede">Choose a topic, record your response, and review your English feedback.</p>
      </header>

      {profileState === 'error' && <p className="dashboard-inline-error" role="alert">{profileError}</p>}

      <section className="topic-section" aria-labelledby="topics-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="eyebrow">A prompt to begin with</p>
            <h2 id="topics-title">Choose a topic.</h2>
            <p className="dashboard-lede">Start speaking opens the topic’s prompt and recording instructions. Record when you’re ready, review your response, then submit it for an AI transcript and English-learning feedback.</p>
          </div>
        </div>

        {topicLoading ? (
          <p className="dashboard-loading" role="status">Loading active topics…</p>
        ) : topicError ? (
          <div className="dashboard-error" role="alert">
            <p>{topicError}</p>
            <button className="text-button" onClick={retry} type="button">Try again</button>
          </div>
        ) : !featured ? (
          <p className="dashboard-empty">There are no active topics available right now. Check back later.</p>
        ) : (
          <>
            <article className="featured-topic">
              <p className="featured-label">Featured topic</p>
              <TopicMeta topic={featured} />
              <h3>{featured.title}</h3>
              <p className="featured-description">{featured.description}</p>
              <p className="featured-description">Talk about the question in your own words. You can include a reason, an example, or a short story.</p>
              <blockquote>{featured.prompt}</blockquote>
              <Link className="button-link" to={`/app/exercise/${featured.id}`}>
                Start speaking <span aria-hidden="true">↗</span>
              </Link>
            </article>

            {topics.length > 1 && (
              <div className="topic-list-wrap">
                <h3 className="list-heading">More active topics</h3>
                <ul className="topic-list">
                  {topics.slice(1).map((topic) => (
                    <li key={topic.id}>
                      <Link to={`/app/exercise/${topic.id}`} className="topic-list-link">
                        <span className="topic-list-copy">
                          <span className="topic-list-title">{topic.title}</span>
                          <TopicMeta topic={topic} />
                        </span>
                        <span className="topic-list-action">Choose topic <span aria-hidden="true">↗</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <section className="recent-section" aria-labelledby="recent-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="eyebrow">Your saved activity</p>
            <h2 id="recent-title">Recent sessions.</h2>
          </div>
          <Link className="text-link" to="/app/history">View all <span aria-hidden="true">↗</span></Link>
        </div>
        {practiceError ? (
          <p className="dashboard-muted">Practice history is unavailable until it can be loaded.</p>
        ) : practiceLoading ? (
          <p className="dashboard-loading" role="status">Loading recent sessions…</p>
        ) : practice?.recentSessions.length ? (
          <ul className="session-list">
            {practice.recentSessions.map((item) => (
              <li key={item.id}>
                <Link className="dashboard-session-link" to={`/app/sessions/${item.id}`}>
                  <span><span className="session-topic">{sessionTopicName(item, topics)}</span><span className="session-date">{formatSessionDate(item.created_at)}</span></span>
                  <span className="session-result">
                    <span className={`session-status status-${item.status}`}>{sessionStatusLabel(item.status, item.recording_path)}</span>
                    {item.duration_seconds > 0 && <span className="session-duration">{item.duration_seconds < 60 ? 'Under a minute' : `${Math.round(item.duration_seconds / 60)} min`}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="session-empty">
            <p>You haven’t saved a speaking session yet.</p>
            {featured && <Link className="text-link" to={`/app/exercise/${featured.id}`}>Choose a topic to get started <span aria-hidden="true">↗</span></Link>}
          </div>
        )}
      </section>

      <section className="progress-section" aria-labelledby="progress-title">
        <h2 id="progress-title" className="eyebrow">Your practice so far</h2>
        {practiceError ? (
          <div className="dashboard-error" role="alert">
            <p>{practiceError}</p>
            <button className="text-button" onClick={retry} type="button">Try again</button>
          </div>
        ) : practiceLoading ? (
          <p className="dashboard-loading" role="status">Loading your progress…</p>
        ) : practice ? (
          <dl className="progress-metrics">
            <div><dt>Sessions started</dt><dd>{practice.totalSessions}<span className="metric-explanation">Saved attempts, including ones awaiting analysis.</span></dd></div>
            <div><dt>Sessions completed</dt><dd>{practice.completedSessions}<span className="metric-explanation">Sessions with saved feedback ready to review.</span></dd></div>
          </dl>
        ) : null}
      </section>
    </div>
  )
}

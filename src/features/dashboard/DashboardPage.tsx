import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useDashboardData } from './useDashboardData'
import type { SpeakingSession, SpeakingTopic, TopicPreferences } from './data'
import { sessionStatusLabel } from '../sessions/sessionData'

function formatSessionDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function sessionTopicName(session: SpeakingSession) {
  return session.topic_title ?? (session.topic_id ? 'Topic unavailable' : 'Unprompted session')
}

function TopicMeta({ topic }: { topic: SpeakingTopic }) {
  return <p className="topic-meta">{topic.difficulty} <span aria-hidden="true">·</span> {topic.category}</p>
}

function TopicPreferencesForm({
  preferences,
  loading,
  saving,
  error,
  onSave,
}: {
  preferences: TopicPreferences
  loading: boolean
  saving: boolean
  error: string | null
  onSave: (preferences: TopicPreferences) => Promise<boolean>
}) {
  const [draft, setDraft] = useState(preferences)
  const [interestText, setInterestText] = useState(preferences.interests.join(', '))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveConfirmed, setSaveConfirmed] = useState(false)

  useEffect(() => {
    setDraft(preferences)
    setInterestText(preferences.interests.join(', '))
  }, [preferences])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const interests = [...new Set(interestText.split(',').map((interest) => interest.trim().toLocaleLowerCase()).filter(Boolean))]
    if (interests.length > 5 || interests.some((interest) => interest.length > 32)) {
      setValidationError('Enter up to five interests, with no more than 32 characters each.')
      return
    }
    setValidationError(null)
    setSaveConfirmed(await onSave({ ...draft, interests }))
  }

  return (
    <details className="topic-preferences">
      <summary>Personalize your topics</summary>
      <p className="dashboard-muted">Choose the kind of conversation you want to practise. Your choices are saved to your account.</p>
      {loading ? <p className="dashboard-loading" role="status">Loading your preferences…</p> : (
        <form className="profile-form topic-preferences-form" onSubmit={(event) => { void handleSubmit(event) }}>
          <label className="form-field">
            <span>Practice situation</span>
            <select disabled={saving} onChange={(event) => { setSaveConfirmed(false); setDraft((value) => ({ ...value, scenario: event.target.value as TopicPreferences['scenario'] })) }} value={draft.scenario}>
              <option value="any">Any situation</option>
              <option value="everyday">Everyday conversation</option>
              <option value="interview">Job interviews</option>
              <option value="workplace">Work and corporate settings</option>
              <option value="presentation">Presentations</option>
              <option value="social">Friends and social situations</option>
              <option value="travel">Travel</option>
              <option value="learning">Learning and reflection</option>
              <option value="creative">Creative ideas</option>
              <option value="opinion">Opinions and discussion</option>
            </select>
          </label>
          <label className="form-field">
            <span>Speaking style</span>
            <select disabled={saving} onChange={(event) => { setSaveConfirmed(false); setDraft((value) => ({ ...value, register: event.target.value as TopicPreferences['register'] })) }} value={draft.register}>
              <option value="any">Any style</option>
              <option value="neutral">Neutral</option>
              <option value="formal">Formal</option>
              <option value="informal">Informal</option>
            </select>
          </label>
          <label className="form-field">
            <span>Difficulty</span>
            <select disabled={saving} onChange={(event) => { setSaveConfirmed(false); setDraft((value) => ({ ...value, difficulty: event.target.value as TopicPreferences['difficulty'] })) }} value={draft.difficulty}>
              <option value="any">Any level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="form-field">
            <span>Interests <span className="field-optional">(optional, comma-separated)</span></span>
            <input autoComplete="off" disabled={saving} maxLength={180} onChange={(event) => { setSaveConfirmed(false); setInterestText(event.target.value) }} placeholder="travel, food, learning" value={interestText} />
            <span className="field-help">Use tags such as travel, food, work, friends, technology, or learning.</span>
          </label>
          {validationError && <p className="form-error" role="alert">{validationError}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {saveConfirmed && <p className="form-notice" role="status">Your preferences are saved and your topic list has been refreshed.</p>}
          <button className="button-link" disabled={saving} type="submit">{saving ? 'Saving preferences…' : 'Save preferences'}</button>
        </form>
      )}
    </details>
  )
}

export function DashboardPage() {
  const { session, profile, profileState, profileError } = useAuth()
  const {
    topics, topicLoading, topicError, practice, practiceLoading, practiceError, retry,
    preferences, preferencesLoading, preferencesSaving, preferencesError, updatePreferences,
  } = useDashboardData()
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

        <TopicPreferencesForm
          error={preferencesError}
          loading={preferencesLoading}
          onSave={updatePreferences}
          preferences={preferences}
          saving={preferencesSaving}
        />

        {topicLoading ? (
          <p className="dashboard-loading" role="status">Loading active topics…</p>
        ) : topicError ? (
          <div className="dashboard-error" role="alert">
            <p>{topicError}</p>
            <button className="text-button" onClick={retry} type="button">Try again</button>
          </div>
        ) : !featured ? (
          <p className="dashboard-empty">No topics match these preferences yet. Choose “Any” for a filter or remove interests to broaden your list.</p>
        ) : (
          <>
            <p className="topic-set-note">{topics.length === 7
              ? 'Your next seven prompts, matched to your preferences.'
              : `Showing ${topics.length} new matching ${topics.length === 1 ? 'prompt' : 'prompts'}. Practised topics return after this matching set is complete.`}</p>
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
                <h3 className="list-heading">Other prompts in this set</h3>
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
                  <span><span className="session-topic">{sessionTopicName(item)}</span><span className="session-date">{formatSessionDate(item.created_at)}</span></span>
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

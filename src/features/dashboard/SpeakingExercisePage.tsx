import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { RecordingWorkflow } from '../recording/RecordingWorkflow'
import { fetchActiveTopic, type SpeakingTopic } from './data'

export function SpeakingExercisePage() {
  const { topicId = '' } = useParams()
  const { client } = useAuth()
  const [topic, setTopic] = useState<SpeakingTopic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    if (!client) {
      setLoading(false)
      setError('Supabase is not configured. Add your project URL and publishable key, then try again.')
      return
    }

    setLoading(true)
    setError(null)
    void fetchActiveTopic(client, topicId).then((result) => {
      if (!active) return
      setTopic(result.topic)
      setError(result.error)
      setLoading(false)
    })
    return () => { active = false }
  }, [client, topicId, revision])

  return (
    <div className="exercise-page">
      <Link className="text-link exercise-back-link" to="/app">← Back to your dashboard</Link>
      {loading ? (
        <p className="dashboard-loading" role="status">Loading this topic…</p>
      ) : error ? (
        <div className="dashboard-error" role="alert">
          <p>{error}</p>
          <button className="text-button" onClick={() => setRevision((value) => value + 1)} type="button">Try again</button>
        </div>
      ) : !topic ? (
        <section className="exercise-unavailable">
          <p className="eyebrow">Topic unavailable</p>
          <h1>This topic can’t be opened.</h1>
          <p>It may have been removed or made inactive. Choose another active topic from your dashboard.</p>
          <Link className="button-link" to="/app">Browse topics</Link>
        </section>
      ) : (
        <article className="speaking-exercise" aria-labelledby="exercise-title">
          <p className="eyebrow">Speaking exercise</p>
          <p className="exercise-topic-meta">{topic.difficulty} <span aria-hidden="true">·</span> {topic.category}</p>
          <h1 id="exercise-title">{topic.title}</h1>
          <p className="exercise-topic-description">{topic.description}</p>
          <div className="exercise-prompt-block">
            <p className="eyebrow">Your prompt</p>
            <p className="exercise-topic-prompt">{topic.prompt}</p>
          </div>
          <p className="exercise-preparation">Take a moment to gather your thoughts. You can begin whenever you’re ready.</p>
          <RecordingWorkflow topic={topic} />
        </article>
      )}
    </div>
  )
}

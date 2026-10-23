import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { fetchActiveTopics, fetchPracticeSummary, type PracticeSummary, type SpeakingTopic } from './data'

export function useDashboardData() {
  const { client, session } = useAuth()
  const userId = session?.user.id
  const [topics, setTopics] = useState<SpeakingTopic[]>([])
  const [topicLoading, setTopicLoading] = useState(true)
  const [topicError, setTopicError] = useState<string | null>(null)
  const [practice, setPractice] = useState<PracticeSummary | null>(null)
  const [practiceLoading, setPracticeLoading] = useState(true)
  const [practiceError, setPracticeError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    if (!client || !userId) {
      setTopicLoading(false)
      setPracticeLoading(false)
      setTopicError('Sign in again to load your dashboard.')
      setPracticeError('Sign in again to load your practice history.')
      return
    }

    setTopicLoading(true)
    setPracticeLoading(true)
    setTopicError(null)
    setPracticeError(null)

    void fetchActiveTopics(client).then((result) => {
      if (!active) return
      setTopics(result.topics)
      setTopicError(result.error)
      setTopicLoading(false)
    })

    void fetchPracticeSummary(client, userId).then((result) => {
      if (!active) return
      setPractice(result.summary)
      setPracticeError(result.error)
      setPracticeLoading(false)
    })

    return () => { active = false }
  }, [client, userId, revision])

  const retry = useCallback(() => setRevision((current) => current + 1), [])
  return { topics, topicLoading, topicError, practice, practiceLoading, practiceError, retry }
}

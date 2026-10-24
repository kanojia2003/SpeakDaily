import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { defaultTopicPreferences, fetchPracticeSummary, fetchPracticeTopicSet, fetchTopicPreferences, saveTopicPreferences, type PracticeSummary, type SpeakingTopic, type TopicPreferences } from './data'

const visitIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getVisitId(userId: string) {
  const key = 'speakdaily-topic-visit:' + userId
  try {
    const existing = window.sessionStorage.getItem(key)
    if (existing && visitIdPattern.test(existing)) return existing
  } catch {
    // Storage may be unavailable; the current page can still receive a set.
  }
  if (!crypto.randomUUID) throw new Error('This browser cannot create a secure topic visit. Update your browser and try again.')
  const visitId = crypto.randomUUID()
  try { window.sessionStorage.setItem(key, visitId) } catch { /* a refresh may start a new visit */ }
  return visitId
}

export function useDashboardData() {
  const { client, session } = useAuth()
  const userId = session?.user.id
  const [topics, setTopics] = useState<SpeakingTopic[]>([])
  const [topicLoading, setTopicLoading] = useState(true)
  const [topicError, setTopicError] = useState<string | null>(null)
  const [practice, setPractice] = useState<PracticeSummary | null>(null)
  const [practiceLoading, setPracticeLoading] = useState(true)
  const [practiceError, setPracticeError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<TopicPreferences>(defaultTopicPreferences)
  const [preferencesLoading, setPreferencesLoading] = useState(true)
  const [preferencesSaving, setPreferencesSaving] = useState(false)
  const [preferencesError, setPreferencesError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    if (!client || !userId) {
      setTopicLoading(false)
      setPracticeLoading(false)
      setPreferencesLoading(false)
      setTopicError('Sign in again to load your dashboard.')
      setPracticeError('Sign in again to load your practice history.')
      setPreferencesError('Sign in again to load your topic preferences.')
      return
    }

    setTopicLoading(true)
    setPracticeLoading(true)
    setPreferencesLoading(true)
    setTopics([])
    setTopicError(null)
    setPracticeError(null)
    setPreferencesError(null)

    void (async () => {
      try {
        const visitId = getVisitId(userId)
        const savedPreferences = await fetchTopicPreferences(client, userId)
        if (!active) return
        setPreferences(savedPreferences)
        setPreferencesLoading(false)
        const assignedTopics = await fetchPracticeTopicSet(client, visitId)
        if (!active) return
        setTopics(assignedTopics)
        setTopicLoading(false)
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Personalized topics could not be loaded. Check your connection and try again.'
        setTopicError(message)
        setPreferencesError(message)
        setTopicLoading(false)
        setPreferencesLoading(false)
      }
    })()

    void fetchPracticeSummary(client, userId).then((result) => {
      if (!active) return
      setPractice(result.summary)
      setPracticeError(result.error)
      setPracticeLoading(false)
    })

    return () => { active = false }
  }, [client, userId, revision])

  const retry = useCallback(() => setRevision((current) => current + 1), [])
  const updatePreferences = useCallback(async (next: TopicPreferences) => {
    if (!client || !userId) {
      setPreferencesError('Sign in again to update your topic preferences.')
      return false
    }
    setPreferencesSaving(true)
    setPreferencesError(null)
    try {
      await saveTopicPreferences(client, userId, next)
      setPreferences(next)
      setRevision((current) => current + 1)
      return true
    } catch (error) {
      setPreferencesError(error instanceof Error ? error.message : 'Your topic preferences could not be saved. Try again.')
      return false
    } finally {
      setPreferencesSaving(false)
    }
  }, [client, userId])

  return { topics, topicLoading, topicError, practice, practiceLoading, practiceError, preferences, preferencesLoading, preferencesSaving, preferencesError, updatePreferences, retry }
}

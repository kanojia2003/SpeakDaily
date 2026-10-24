import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'

export type SpeakingTopic = Database['public']['Tables']['speaking_topics']['Row']
export type SpeakingSession = Pick<
  Database['public']['Tables']['speaking_sessions']['Row'],
  'id' | 'topic_id' | 'topic_title' | 'status' | 'duration_seconds' | 'recording_path' | 'created_at'
>
export type TopicScenario = Database['public']['Tables']['user_topic_preferences']['Row']['scenario']
export type TopicRegister = Database['public']['Tables']['user_topic_preferences']['Row']['register']
export type TopicDifficulty = Database['public']['Tables']['user_topic_preferences']['Row']['difficulty']
export type TopicPreferences = { scenario: TopicScenario; register: TopicRegister; difficulty: TopicDifficulty; interests: string[] }
export const defaultTopicPreferences: TopicPreferences = { scenario: 'any', register: 'any', difficulty: 'any', interests: [] }
export type PracticeSummary = {
  recentSessions: SpeakingSession[]
  totalSessions: number
  completedSessions: number
}

type Client = SupabaseClient<Database>

export async function fetchTopicPreferences(client: Client, userId: string): Promise<TopicPreferences> {
  const { data, error } = await client.from('user_topic_preferences')
    .select('scenario, register, difficulty, interests').eq('user_id', userId).maybeSingle()
  if (error) throw new Error('Your topic preferences could not be loaded. Apply the personalized topic migration and try again.')
  return data ? { scenario: data.scenario, register: data.register, difficulty: data.difficulty, interests: data.interests } : defaultTopicPreferences
}

export async function saveTopicPreferences(client: Client, userId: string, preferences: TopicPreferences) {
  const { error } = await client.from('user_topic_preferences').upsert({
    user_id: userId, scenario: preferences.scenario, register: preferences.register,
    difficulty: preferences.difficulty, interests: preferences.interests,
  }, { onConflict: 'user_id' })
  if (error) throw new Error('Your topic preferences could not be saved. Check your connection and try again.')
}

export async function fetchPracticeTopicSet(client: Client, visitId: string) {
  const { data, error } = await client.rpc('get_practice_topic_set', { p_visit_id: visitId })
  if (error) throw new Error('Personalized topics could not be loaded. Apply the personalized topic migration and try again.')
  return data ?? []
}

export async function fetchActiveTopic(client: Client, topicId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(topicId)) {
    return { topic: null, error: null }
  }

  try {
    const { data, error } = await client
      .from('speaking_topics')
      .select('id, title, description, prompt, difficulty, category, scenario, register, keywords, is_active, created_at')
      .eq('id', topicId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) return { topic: null, error: 'This topic could not be loaded. Check your connection and try again.' }
    return { topic: data, error: null }
  } catch {
    return { topic: null, error: 'This topic could not be loaded. Check your connection and try again.' }
  }
}

export async function fetchPracticeSummary(client: Client, userId: string) {
  try {
    const [recent, total, completed] = await Promise.all([
      client
        .from('speaking_sessions')
        .select('id, topic_id, topic_title, status, duration_seconds, recording_path, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      client.from('speaking_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      client.from('speaking_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed'),
    ])

    if (recent.error || total.error || completed.error) {
      return { summary: null, error: 'Your practice history could not be loaded. Check your connection and try again.' }
    }

    const summary: PracticeSummary = {
      recentSessions: recent.data ?? [],
      totalSessions: total.count ?? 0,
      completedSessions: completed.count ?? 0,
    }
    return { summary, error: null }
  } catch {
    return { summary: null, error: 'Your practice history could not be loaded. Check your connection and try again.' }
  }
}

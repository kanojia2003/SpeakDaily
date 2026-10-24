import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'

export type SpeakingTopic = Database['public']['Tables']['speaking_topics']['Row']
export type SpeakingSession = Pick<
  Database['public']['Tables']['speaking_sessions']['Row'],
  'id' | 'topic_id' | 'status' | 'duration_seconds' | 'recording_path' | 'created_at'
>
export type PracticeSummary = {
  recentSessions: SpeakingSession[]
  totalSessions: number
  completedSessions: number
}

type Client = SupabaseClient<Database>

export async function fetchActiveTopics(client: Client) {
  try {
    const { data, error } = await client
      .from('speaking_topics')
      .select('id, title, description, prompt, difficulty, category, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) return { topics: [] as SpeakingTopic[], error: 'Active topics could not be loaded. Check your connection and try again.' }
    return { topics: data ?? [], error: null }
  } catch {
    return { topics: [] as SpeakingTopic[], error: 'Active topics could not be loaded. Check your connection and try again.' }
  }
}

export async function fetchActiveTopic(client: Client, topicId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(topicId)) {
    return { topic: null, error: null }
  }

  try {
    const { data, error } = await client
      .from('speaking_topics')
      .select('id, title, description, prompt, difficulty, category, is_active, created_at')
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
        .select('id, topic_id, status, duration_seconds, recording_path, created_at')
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

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'

export type SavedSession = Pick<Database['public']['Tables']['speaking_sessions']['Row'], 'id' | 'user_id' | 'topic_id' | 'topic_title' | 'status' | 'duration_seconds' | 'transcript' | 'feedback' | 'error_message' | 'recording_path' | 'created_at' | 'updated_at'>
export const SESSION_PAGE_SIZE = 20
type Client = SupabaseClient<Database>

export async function fetchSessionPage(client: Client, userId: string, offset: number) {
  const { data, error, count } = await client.from('speaking_sessions')
    .select('id, user_id, topic_id, topic_title, status, duration_seconds, transcript, feedback, error_message, recording_path, created_at, updated_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + SESSION_PAGE_SIZE - 1)
  if (error) throw new Error('Your practice history could not be loaded. Check your connection and try again.')
  return { sessions: data ?? [], total: count ?? 0 }
}

export async function fetchSavedSession(client: Client, userId: string, sessionId: string) {
  const { data, error } = await client.from('speaking_sessions')
    .select('id, user_id, topic_id, topic_title, status, duration_seconds, transcript, feedback, error_message, recording_path, created_at, updated_at')
    .eq('id', sessionId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error('This saved session could not be loaded. Check your connection and try again.')
  return data
}

export async function fetchTopicTitles(client: Client, topicIds: string[]) {
  if (topicIds.length === 0) return new Map<string, string>()
  const { data, error } = await client.from('speaking_topics').select('id, title').in('id', topicIds)
  if (error) throw new Error('Topic names could not be loaded. Check your connection and try again.')
  return new Map((data ?? []).map((topic) => [topic.id, topic.title]))
}

export function sessionStatusLabel(status: SavedSession['status']) {
  switch (status) {
    case 'pending': return 'Pending'
    case 'processing': return 'Processing'
    case 'completed': return 'Completed'
    case 'failed': return 'Failed'
  }
}

export function formatSessionDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`
}

export function formatSessionDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

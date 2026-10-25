import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../lib/database.types'

export type CommunicationScenario = Exclude<Database['public']['Tables']['user_topic_preferences']['Row']['scenario'], 'any'>
export type CommunicationRegister = Exclude<Database['public']['Tables']['user_topic_preferences']['Row']['register'], 'any'>
export type CommunicationDifficulty = Exclude<Database['public']['Tables']['user_topic_preferences']['Row']['difficulty'], 'any'>
export type CommunicationQuestion = { title: string; prompt: string }
export type CommunicationRun = Database['public']['Tables']['communication_practice_runs']['Row']
export type CommunicationAnswer = Pick<Database['public']['Tables']['speaking_sessions']['Row'], 'id' | 'communication_question_index' | 'status' | 'recording_path' | 'duration_seconds' | 'created_at'>
type Client = SupabaseClient<Database>

export function parseCommunicationQuestions(value: Json): CommunicationQuestion[] | null {
  if (!Array.isArray(value) || value.length !== 4) return null
  const questions: CommunicationQuestion[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const title = item.title
    const prompt = item.prompt
    if (typeof title !== 'string' || typeof prompt !== 'string' || title.length > 80 || prompt.length > 400) return null
    questions.push({ title, prompt })
  }
  return questions
}

export async function fetchCommunicationRun(client: Client, userId: string, runId: string) {
  const { data, error } = await client.from('communication_practice_runs')
    .select('*').eq('id', runId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error('This communication practice could not be loaded. Check your connection and try again.')
  return data
}

export async function fetchRecentCommunicationRuns(client: Client, userId: string) {
  const { data, error } = await client.from('communication_practice_runs')
    .select('id, scenario, register, difficulty, status, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(5)
  if (error) throw new Error('Your recent communication practices could not be loaded.')
  return data ?? []
}

export async function fetchCommunicationAnswers(client: Client, userId: string, runId: string) {
  const { data, error } = await client.from('speaking_sessions')
    .select('id, communication_question_index, status, recording_path, duration_seconds, created_at')
    .eq('communication_practice_run_id', runId).eq('user_id', userId)
    .order('communication_question_index', { ascending: true })
  if (error) throw new Error('Your saved answers could not be loaded. Check your connection and try again.')
  return data ?? []
}

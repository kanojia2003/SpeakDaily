import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

let client: SupabaseClient<Database> | undefined

/** Create the browser client only when a feature needs it and public config is present. */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey || publishableKey === 'your-supabase-publishable-key') {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your local .env file.',
    )
  }

  client = createClient<Database>(url, publishableKey)
  return client
}

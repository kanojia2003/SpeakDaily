import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'
import { getSupabaseClient } from '../lib/supabase'

type Profile = { display_name: string | null }
type ProfileState = 'idle' | 'loading' | 'ready' | 'error'

type AuthContextValue = {
  client: SupabaseClient<Database> | null
  configurationError: string | null
  session: Session | null
  loading: boolean
  sessionExpired: boolean
  profile: Profile | null
  profileState: ProfileState
  profileError: string | null
  updateDisplayName: (displayName: string) => Promise<void>
  clearSessionExpired: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [clientState] = useState(() => {
    try {
      return { client: getSupabaseClient(), error: null }
    } catch (error) {
      return {
        client: null,
        error: error instanceof Error ? error.message : 'Supabase configuration is missing.',
      }
    }
  })
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileState, setProfileState] = useState<ProfileState>('idle')
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    const { client } = clientState
    if (!client) {
      setLoading(false)
      return
    }

    let active = true
    let authEventReceived = false
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      authEventReceived = true
      if (event === 'SIGNED_OUT' && sessionRef.current) setSessionExpired(true)
      if (nextSession) setSessionExpired(false)
      sessionRef.current = nextSession
      setSession(nextSession)
      setLoading(false)
    })

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (!authEventReceived) {
        sessionRef.current = data.session
        setSession(data.session)
      }
      if (error) setSessionExpired(true)
      setLoading(false)
    }).catch(() => {
      if (active) {
        setSessionExpired(true)
        setLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [clientState])

  useEffect(() => {
    const { client } = clientState
    const userId = session?.user.id
    if (!client || !userId) {
      setProfile(null)
      setProfileError(null)
      setProfileState('idle')
      return
    }

    let active = true
    setProfileState('loading')
    setProfileError(null)

    void client
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setProfileError('Your profile could not be loaded. Check that the SpeakDaily database migration has been applied.')
          setProfileState('error')
          return
        }
        if (!data) {
          setProfileError('Your profile is not available yet. Check that profile creation is enabled in the database.')
          setProfileState('error')
          return
        }
        setProfile({ display_name: data.display_name })
        setProfileState('ready')
      }, () => {
        if (active) {
          setProfileError('Your profile could not be loaded. Check your connection and try again.')
          setProfileState('error')
        }
      })

    return () => { active = false }
  }, [clientState, session?.user.id])

  async function updateDisplayName(displayName: string) {
    const { client } = clientState
    const userId = session?.user.id
    if (!client || !userId) throw new Error('Sign in again to update your profile.')

    const { data, error } = await client
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', userId)
      .select('display_name')
      .single()

    if (error) throw error
    if (!data || typeof data.display_name !== 'string') {
      throw new Error('The profile update could not be confirmed. Please try again.')
    }
    setProfile({ display_name: data.display_name })
  }

  return (
    <AuthContext.Provider value={{
      client: clientState.client,
      configurationError: clientState.error,
      session,
      loading,
      sessionExpired,
      profile,
      profileState,
      profileError,
      updateDisplayName,
      clearSessionExpired: () => setSessionExpired(false),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}

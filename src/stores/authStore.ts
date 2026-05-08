import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { AuthUser, User } from '@/types'

interface AuthStore {
  user: AuthUser | null
  profile: User | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null })
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      if (data.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (profileError) throw profileError

        set({
          user: { id: data.user.id, email: data.user.email || '' },
          profile: profileData,
          loading: false,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed'
      set({ error: message, loading: false })
      throw error
    }
  },

  signOut: async () => {
    try {
      set({ loading: true })
      await supabase.auth.signOut()
      set({ user: null, profile: null, loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Sign out failed', loading: false })
      throw error
    }
  },

  initialize: async () => {
    try {
      set({ loading: true })
      const { data } = await supabase.auth.getSession()

      if (data.session?.user) {
        const { data: profileData } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.session.user.id)
          .single()

        set({
          user: { id: data.session.user.id, email: data.session.user.email || '' },
          profile: profileData,
          loading: false,
        })
      } else {
        set({ loading: false })
      }

      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          set({ user: { id: session.user.id, email: session.user.email || '' } })
        } else {
          set({ user: null, profile: null })
        }
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Init failed', loading: false })
    }
  },
}))

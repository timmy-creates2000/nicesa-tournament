import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { signIn as apiSignIn, signOut as apiSignOut, getSession, isAdmin } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [loading, setLoading] = useState(true)

  // Hydrate from stored token on mount
  useEffect(() => {
    getSession()
      .then(s => setSession(s))
      .catch(() => setSession(null))
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (email, password) => {
    const data = await apiSignIn(email, password)
    // Re-read session so all consumers update
    const s = await getSession()
    setSession(s)
    return data
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut()
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      session,
      user:        session?.admin ?? null,
      loading,
      isAdminUser: isAdmin(session),
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getTournamentSettings, poll } from '../lib/api'

const TournamentContext = createContext(null)

export function TournamentProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getTournamentSettings()
      setSettings(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // Poll every 15 s instead of Supabase real-time
    const stop = poll(refresh, 15000)
    return stop
  }, [refresh])

  const isRegistrationOpen = settings?.phase === 'registration_open'
  const isDrawPublished    = ['draw_published', 'in_progress', 'completed'].includes(settings?.phase)

  return (
    <TournamentContext.Provider value={{ settings, loading, error, refresh, isRegistrationOpen, isDrawPublished }}>
      {children}
    </TournamentContext.Provider>
  )
}

export function useTournament() {
  const ctx = useContext(TournamentContext)
  if (!ctx) throw new Error('useTournament must be used inside <TournamentProvider>')
  return ctx
}

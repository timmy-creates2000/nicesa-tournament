import { useState, useEffect, useCallback } from 'react'
import { getRegistrationSummary, poll } from '../lib/api'

export function useRegistrationSummary() {
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await getRegistrationSummary()
      setSummary(data ?? [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const stop = poll(load, 15000)
    return stop
  }, [load])

  const total = summary.reduce((acc, r) => acc + Number(r.confirmed_count ?? 0), 0)

  return { summary, total, loading, error, refresh: load }
}

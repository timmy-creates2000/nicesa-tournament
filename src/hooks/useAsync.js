import { useState, useCallback } from 'react'

/**
 * Generic hook for tracking async operation state.
 * Returns { run, data, loading, error, reset }.
 */
export function useAsync() {
  const [state, setState] = useState({ data: null, loading: false, error: null })

  const run = useCallback(async (promise) => {
    setState({ data: null, loading: true, error: null })
    try {
      const data = await promise
      setState({ data, loading: false, error: null })
      return data
    } catch (err) {
      setState({ data: null, loading: false, error: err.message ?? String(err) })
      throw err
    }
  }, [])

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), [])

  return { ...state, run, reset }
}

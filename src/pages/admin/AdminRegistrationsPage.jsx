import { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw, Download, Users, Filter } from 'lucide-react'
import { getRegistrations } from '../../lib/api'
import { LevelBadge, StatusBadge } from '../../components/ui/Badge'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useRegistrationSummary } from '../../hooks/useRegistrationSummary'
import { format } from 'date-fns'

function exportCsv(rows) {
  const header = 'Matric Number,Full Name,Level,Status,Registered At'
  const lines  = rows.map(r =>
    [r.matric_number, `"${r.full_name}"`, r.level, r.status,
     format(new Date(r.registered_at), 'yyyy-MM-dd HH:mm:ss')].join(',')
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `registrations_${Date.now()}.csv`
  a.click()
}

export default function AdminRegistrationsPage() {
  const { summary, total } = useRegistrationSummary()
  const [registrations, setRegistrations] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [search,        setSearch]        = useState('')
  const [level,         setLevel]         = useState('')
  const [status,        setStatus]        = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await getRegistrations({
        search: search || undefined,
        level:  level  || undefined,
        status: status || undefined,
      })
      setRegistrations(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, level, status])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Registrations</h1>
          <p className="text-sm text-pitch-400">{total} confirmed · across 5 levels</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv(registrations)} disabled={!registrations.length}
            className="btn-outline text-sm py-2 gap-1.5">
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={load} className="btn-outline text-sm py-2 gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Level filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {['100','200','300','400','500'].map(l => {
          const count = Number(summary.find(r => r.level === l)?.confirmed_count ?? 0)
          return (
            <button key={l} onClick={() => setLevel(level === l ? '' : l)}
              aria-pressed={level === l}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${level === l ? 'bg-gold-500 text-pitch-950' : 'bg-pitch-800 text-pitch-300 hover:bg-pitch-700'}`}>
              <LevelBadge level={l} /> {count}
            </button>
          )
        })}
        {level && (
          <button onClick={() => setLevel('')}
            className="px-3 py-1.5 rounded-full text-xs bg-pitch-700 text-pitch-300 hover:bg-pitch-600">
            Clear
          </button>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={e => { e.preventDefault(); load() }} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pitch-400" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or matric…" className="input pl-9 text-sm py-2" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="input text-sm py-2 w-36">
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          <Filter className="h-4 w-4" />
        </button>
      </form>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : registrations.length === 0 ? (
        <EmptyState icon={Users} title="No registrations found" description="Try adjusting your search." />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Matric</th><th>Full Name</th><th>Level</th><th>Status</th><th>Registered</th></tr>
            </thead>
            <tbody>
              {registrations.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-pitch-500 tabular-nums">{i + 1}</td>
                  <td className="font-mono text-xs">{r.matric_number}</td>
                  <td className="font-medium text-white">{r.full_name}</td>
                  <td><LevelBadge level={r.level} /></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-xs text-pitch-400 whitespace-nowrap">
                    {format(new Date(r.registered_at), 'dd MMM yy · HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-pitch-700/40 text-xs text-pitch-500">
            Showing {registrations.length} registration{registrations.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { ClipboardList, RefreshCw, ChevronDown } from 'lucide-react'
import { getAuditLog } from '../../lib/api'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { format } from 'date-fns'

const ACTION_COLOURS = {
  draw_generated:       'text-blue-400  bg-blue-950/40  border-blue-800/40',
  draw_published:       'text-gold-400  bg-gold-950/40  border-gold-800/40',
  registration_opened:  'text-green-400 bg-green-950/40 border-green-800/40',
  registration_closed:  'text-red-400   bg-red-950/40   border-red-800/40',
  student_registered:   'text-pitch-300 bg-pitch-800/40 border-pitch-700/40',
  student_list_uploaded:'text-purple-400 bg-purple-950/40 border-purple-800/40',
  fixture_created:      'text-blue-300  bg-blue-950/30  border-blue-800/30',
  score_entered:        'text-green-300 bg-green-950/30 border-green-800/30',
  admin_login:          'text-pitch-400 bg-pitch-800/30 border-pitch-700/30',
}

function AuditRow({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const cls = ACTION_COLOURS[entry.action] ?? 'text-pitch-300 bg-pitch-800/40 border-pitch-700/40'

  return (
    <div className="border border-pitch-700/40 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-pitch-800/30 transition-colors text-left">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
            {entry.action.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-pitch-400 truncate">{entry.actor_email ?? 'System'}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-pitch-500 whitespace-nowrap hidden sm:block">
            {format(new Date(entry.created_at), 'dd MMM yy · HH:mm')}
          </span>
          <ChevronDown className={`h-4 w-4 text-pitch-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-pitch-700/30 space-y-2">
          {entry.target_id && (
            <p className="text-xs text-pitch-400">Target: <code className="text-pitch-300">{entry.target_id}</code></p>
          )}
          <div>
            <p className="text-xs text-pitch-500 mb-1">Payload:</p>
            <pre className="text-xs text-pitch-300 bg-pitch-800/60 rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(
                typeof entry.payload === 'string' ? JSON.parse(entry.payload) : entry.payload,
                null, 2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [offset,  setOffset]  = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 30

  async function load(reset = false) {
    setLoading(true); setError('')
    const off = reset ? 0 : offset
    try {
      const data = await getAuditLog({ limit: LIMIT, offset: off })
      if (reset) { setEntries(data ?? []); setOffset(LIMIT) }
      else { setEntries(prev => [...prev, ...(data ?? [])]); setOffset(off + LIMIT) }
      setHasMore((data?.length ?? 0) === LIMIT)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(true) }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Audit Log</h1>
          <p className="text-sm text-pitch-400">Complete history of all administrative actions</p>
        </div>
        <button onClick={() => load(true)} className="btn-outline gap-1.5 py-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading && entries.length === 0 ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No audit entries yet"
          description="Admin actions will appear here as they happen." />
      ) : (
        <div className="space-y-2">
          {entries.map(e => <AuditRow key={e.id} entry={e} />)}
          {hasMore && (
            <div className="text-center pt-4">
              <button onClick={() => load(false)} disabled={loading} className="btn-outline text-sm gap-1.5">
                {loading ? <Spinner size="sm" /> : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

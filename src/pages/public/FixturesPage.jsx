import { useEffect, useState } from 'react'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { getFixtures } from '../../lib/api'
import { StatusBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Alert } from '../../components/ui/Alert'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'

function FixtureCard({ fixture }) {
  const { home_team, away_team, home_score, away_score, status, scheduled_at, venue, round } = fixture
  const isCompleted = status === 'completed'
  return (
    <article className="card hover:border-pitch-600/60 transition-colors p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-pitch-400">Round {round}</span>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-center gap-3 justify-between">
        <Link to={`/team/${home_team?.id}`} className="flex-1 text-right">
          <p className="text-sm font-bold text-white hover:text-gold-300 transition-colors">
            {home_team?.team_name ?? '—'}
          </p>
        </Link>
        <div className="shrink-0">
          {isCompleted
            ? <span className="text-xl font-extrabold text-white tabular-nums">{home_score} – {away_score}</span>
            : <span className="text-sm text-pitch-400 font-medium">vs</span>}
        </div>
        <Link to={`/team/${away_team?.id}`} className="flex-1">
          <p className="text-sm font-bold text-white hover:text-gold-300 transition-colors">
            {away_team?.team_name ?? '—'}
          </p>
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-pitch-400">
        {scheduled_at && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {format(new Date(scheduled_at), 'EEE, dd MMM · HH:mm')}
          </span>
        )}
        {venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{venue}</span>}
      </div>
    </article>
  )
}

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState('all')

  useEffect(() => {
    getFixtures()
      .then(data => setFixtures(data ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const rounds   = [...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b)
  const filtered = filter === 'all' ? fixtures : fixtures.filter(f => f.status === filter)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <CalendarDays className="h-6 w-6 text-gold-400" />
          <h1 className="text-2xl font-extrabold text-white">Fixtures</h1>
        </div>
        <div className="gold-bar w-12" />
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      <div className="flex gap-2 mb-6 flex-wrap" role="group" aria-label="Filter fixtures">
        {['all', 'scheduled', 'in_progress', 'completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all
              ${filter === f ? 'bg-gold-500 text-pitch-950' : 'bg-pitch-800 text-pitch-300 hover:bg-pitch-700'}`}>
            {f === 'all' ? 'All' : f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No fixtures yet"
          description="Fixtures will appear here once the schedule is published." />
      ) : (
        <div className="space-y-8">
          {rounds.map(round => {
            const rf = filtered.filter(f => f.round === round)
            if (!rf.length) return null
            return (
              <section key={round}>
                <h2 className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-3">Round {round}</h2>
                <div className="space-y-3">{rf.map(f => <FixtureCard key={f.id} fixture={f} />)}</div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

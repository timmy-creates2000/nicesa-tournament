import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Search, Users, Trophy, Info, AlertTriangle, Star, Clock,
} from 'lucide-react'
import { getMyTeam } from '../../lib/api'
import { useTournament } from '../../context/TournamentContext'
import { LevelBadge } from '../../components/ui/Badge'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'

function TeamCard({ team }) {
  const starters   = team.teammates?.filter(m => !m.is_substitute) ?? []
  const subs       = team.teammates?.filter(m => m.is_substitute)  ?? []

  return (
    <div className="card-elevated overflow-hidden animate-slide-up">
      {/* Gold bar */}
      <div className="gold-bar" aria-hidden />

      <div className="p-6">
        {/* Team name */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl
                          bg-gold-900/30 border border-gold-700/40">
            <Trophy className="h-6 w-6 text-gold-400" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{team.team_name}</h2>
            <p className="text-xs text-pitch-400">
              {team.is_substitute
                ? 'You are a substitute player'
                : `Starting position ${team.slot_position}`}
            </p>
          </div>
        </div>

        {/* Starters */}
        {starters.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-2">
              Starting Five
            </h3>
            <ul className="space-y-2" role="list">
              {starters.map((m, i) => (
                <li
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg
                    ${!m.is_substitute && m.full_name === team.you_name
                      ? 'bg-gold-900/20 border border-gold-700/30'
                      : 'bg-pitch-800/50'
                    }`}
                >
                  <span className="text-sm font-medium text-white">{m.full_name}</span>
                  <LevelBadge level={m.level} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Substitutes */}
        {subs.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-2">
              Substitutes
            </h3>
            <ul className="space-y-2" role="list">
              {subs.map((m, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-pitch-800/40">
                  <span className="text-sm text-pitch-200">{m.full_name}</span>
                  <LevelBadge level={m.level} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-6 py-4 border-t border-pitch-700/40 flex gap-3">
        <Link to={`/team/${team.team_id}`} className="btn-outline flex-1 justify-center py-2">
          <Users className="h-4 w-4" aria-hidden /> Full Team Page
        </Link>
        <Link to="/fixtures" className="btn-primary flex-1 justify-center py-2">
          View Fixtures
        </Link>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { isDrawPublished, settings } = useTournament()
  const location = useLocation()

  const [matric,  setMatric]  = useState(location.state?.matric ?? '')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState('')

  async function handleLookup(e) {
    e.preventDefault()
    const trimmed = matric.trim().toUpperCase()
    if (!trimmed) { setError('Please enter your matric number.'); return }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await getMyTeam(trimmed)
      setResult(data)
    } catch (err) {
      setError(err.message ?? 'Could not look up your team. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl
                        bg-pitch-800 border border-gold-600/40 mb-4">
          <Users className="h-7 w-7 text-gold-400" aria-hidden />
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-1">My Team</h1>
        <p className="text-sm text-pitch-300">
          Enter your matric number to see your assigned squad
        </p>
      </div>

      {/* Draw not published yet */}
      {!isDrawPublished && (
        <Alert variant="info" className="mb-6">
          <strong>The draw hasn't been published yet.</strong><br />
          Team assignments will be visible here once the tournament committee publishes the draw.
          {settings?.phase === 'registration_open' && (
            <> Registration is still open — <Link to="/register" className="underline text-blue-300">register now</Link> if you haven't.</>
          )}
        </Alert>
      )}

      {/* Lookup form */}
      <div className="card-elevated p-6 mb-6">
        <form onSubmit={handleLookup} aria-label="Team lookup form">
          <label htmlFor="dash-matric" className="label">Your Matric Number</label>
          <div className="flex gap-2">
            <input
              id="dash-matric"
              type="text"
              value={matric}
              onChange={e => { setMatric(e.target.value); setError('') }}
              placeholder="e.g. CVE/2022/001"
              disabled={loading}
              maxLength={20}
              autoCapitalize="characters"
              spellCheck={false}
              className="input font-mono tracking-wider uppercase flex-1"
              aria-describedby={error ? 'dash-error' : undefined}
            />
            <button
              type="submit"
              disabled={loading || !isDrawPublished}
              className="btn-gold shrink-0 px-4"
              aria-label="Look up my team"
            >
              {loading ? <Spinner size="sm" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          {error && (
            <p id="dash-error" className="form-error" role="alert">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
        </form>
      </div>

      {/* Result */}
      {result !== null && (
        result.found ? (
          <TeamCard team={result} />
        ) : (
          <Alert variant="warning">
            <strong>No team found.</strong> This matric number either hasn't registered or
            the draw hasn't been published yet.
            {settings?.phase === 'registration_open' && (
              <> <Link to="/register" className="underline">Register here</Link> if you haven't yet.</>
            )}
          </Alert>
        )
      )}

      {/* Not yet published hint */}
      {!isDrawPublished && (
        <div className="mt-6 card p-5 flex items-start gap-3">
          <Clock className="h-5 w-5 text-pitch-400 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-pitch-200">Waiting for the draw</p>
            <p className="text-xs text-pitch-400 mt-0.5">
              The committee will run the random draw once registration closes.
              You'll be able to look up your team here as soon as it's published.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

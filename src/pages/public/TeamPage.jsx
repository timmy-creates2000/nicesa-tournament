import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Users, Trophy, CalendarDays } from 'lucide-react'
import { getTeam, getFixtures } from '../../lib/api'
import { LevelBadge, StatusBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Alert } from '../../components/ui/Alert'
import { format } from 'date-fns'

function PlayerRow({ member, position }) {
  const { full_name, level, is_substitute, matric_number } = member.registrations
  return (
    <li className="flex items-center gap-3 px-4 py-3 rounded-xl bg-pitch-800/50 hover:bg-pitch-800 transition-colors">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pitch-700 text-xs font-bold text-pitch-200 shrink-0">
        {is_substitute ? 'S' : position}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{full_name}</p>
        <p className="text-xs text-pitch-400 font-mono">{matric_number}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <LevelBadge level={level} />
        {is_substitute && (
          <span className="text-[10px] text-pitch-500 bg-pitch-800 border border-pitch-700 px-2 py-0.5 rounded-full">SUB</span>
        )}
      </div>
    </li>
  )
}

function FixtureRow({ fixture, teamId }) {
  const isHome   = fixture.home_team?.id === teamId
  const opponent = isHome ? fixture.away_team : fixture.home_team
  const myScore  = isHome ? fixture.home_score : fixture.away_score
  const oppScore = isHome ? fixture.away_score : fixture.home_score

  let resultCls = 'text-pitch-400', resultLabel = '—'
  if (fixture.status === 'completed' && myScore != null && oppScore != null) {
    if (myScore > oppScore)       { resultCls = 'text-green-400';  resultLabel = 'W' }
    else if (myScore === oppScore){ resultCls = 'text-yellow-400'; resultLabel = 'D' }
    else                          { resultCls = 'text-red-400';    resultLabel = 'L' }
  }

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-pitch-800/40 hover:bg-pitch-800/70 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">
          vs <span className="text-gold-300">{opponent?.team_name ?? '—'}</span>
        </p>
        <p className="text-xs text-pitch-400">
          Round {fixture.round}
          {fixture.scheduled_at && ` · ${format(new Date(fixture.scheduled_at), 'dd MMM, HH:mm')}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        {fixture.status === 'completed'
          ? <><p className="text-sm font-bold text-white">{myScore}–{oppScore}</p>
              <span className={`text-xs font-bold ${resultCls}`}>{resultLabel}</span></>
          : <StatusBadge status={fixture.status} />}
      </div>
    </li>
  )
}

export default function TeamPage() {
  const { teamId } = useParams()
  const [team,     setTeam]     = useState(null)
  const [fixtures, setFixtures] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true); setError('')
      try {
        const [teamData, allFixtures] = await Promise.all([getTeam(teamId), getFixtures()])
        setTeam(teamData)
        setFixtures((allFixtures ?? []).filter(
          f => f.home_team?.id === teamId || f.away_team?.id === teamId
        ))
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }
    load()
  }, [teamId])

  if (loading) return <div className="flex justify-center items-center py-32"><Spinner size="lg" /></div>
  if (error)   return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Alert variant="error">{error}</Alert>
      <div className="mt-4 text-center"><Link to="/dashboard" className="btn-outline">← Back</Link></div>
    </div>
  )
  if (!team) return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <EmptyState icon={Users} title="Team not found"
        action={<Link to="/dashboard" className="btn-outline">Back to Dashboard</Link>} />
    </div>
  )

  const starters = team.team_members?.filter(m => !m.is_substitute).sort((a,b) => a.slot_position - b.slot_position) ?? []
  const subs     = team.team_members?.filter(m =>  m.is_substitute).sort((a,b) => a.slot_position - b.slot_position) ?? []
  const levels   = [...new Set(team.team_members?.map(m => m.registrations?.level) ?? [])]

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="card-elevated overflow-hidden mb-6">
        <div className="gold-bar" />
        <div className="p-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-900/30 border border-gold-700/40 shrink-0">
            <Trophy className="h-7 w-7 text-gold-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">{team.team_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {levels.map(l => <LevelBadge key={l} level={l} />)}
              <span className="text-xs text-pitch-400">· {team.team_members?.length} players</span>
            </div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-3 px-1">Squad Roster</h2>
        {starters.length > 0 && (
          <><p className="text-xs text-pitch-500 px-1 mb-2">Starting Players</p>
            <ul className="space-y-2">{starters.map((m,i) => <PlayerRow key={m.id} member={m} position={i+1} />)}</ul></>
        )}
        {subs.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-pitch-500 px-1 mb-2">Substitutes</p>
            <ul className="space-y-2">{subs.map((m,i) => <PlayerRow key={m.id} member={m} position={i+1} />)}</ul>
          </div>
        )}
      </section>

      {/* Fixtures */}
      <section>
        <h2 className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Fixtures
        </h2>
        {fixtures.length === 0
          ? <div className="card p-5 text-center"><p className="text-sm text-pitch-400">No fixtures scheduled yet.</p></div>
          : <ul className="space-y-2">{fixtures.map(f => <FixtureRow key={f.id} fixture={f} teamId={teamId} />)}</ul>}
      </section>

      <div className="mt-8 flex gap-3">
        <Link to="/dashboard"  className="btn-outline">← Dashboard</Link>
        <Link to="/standings"  className="btn-primary">Standings →</Link>
      </div>
    </div>
  )
}

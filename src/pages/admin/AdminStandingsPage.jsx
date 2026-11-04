import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart2, RefreshCw, Trophy } from 'lucide-react'
import { getStandings } from '../../lib/api'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'

export default function AdminStandingsPage() {
  const [standings, setStandings] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  async function load() {
    setLoading(true); setError('')
    try { setStandings((await getStandings()) ?? []) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Standings</h1>
          <p className="text-sm text-pitch-400">Recalculated automatically after each score entry</p>
        </div>
        <button onClick={load} className="btn-outline gap-1.5 py-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : standings.length === 0 ? (
        <EmptyState icon={BarChart2} title="No standings yet"
          description="Standings populate after match scores are entered."
          action={<Link to="/admin/fixtures" className="btn-outline">Go to Fixtures</Link>} />
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="pl-5">#</th><th>Team</th>
                  <th className="text-center">P</th><th className="text-center">W</th>
                  <th className="text-center">D</th><th className="text-center">L</th>
                  <th className="text-center">GF</th><th className="text-center">GA</th>
                  <th className="text-center">GD</th><th className="text-center text-gold-300">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const gd    = row.goals_for - row.goals_against
                  const gdCls = gd > 0 ? 'text-green-400' : gd < 0 ? 'text-red-400' : 'text-pitch-400'
                  return (
                    <tr key={row.team_id} className={i === 0 ? 'border-l-2 border-l-gold-500' : ''}>
                      <td className="pl-5 font-bold text-pitch-300">
                        {i === 0 ? <Trophy className="h-4 w-4 text-gold-400 inline" /> : i + 1}
                      </td>
                      <td>
                        <Link to={`/team/${row.team_id}`}
                          className="font-semibold text-white hover:text-gold-300 transition-colors">
                          {row.teams?.team_name ?? row.team_name ?? '—'}
                        </Link>
                      </td>
                      <td className="text-center">{row.played}</td>
                      <td className="text-center text-green-400 font-medium">{row.won}</td>
                      <td className="text-center text-yellow-400 font-medium">{row.drawn}</td>
                      <td className="text-center text-red-400 font-medium">{row.lost}</td>
                      <td className="text-center">{row.goals_for}</td>
                      <td className="text-center">{row.goals_against}</td>
                      <td className={`text-center font-semibold ${gdCls}`}>{gd > 0 ? '+' : ''}{gd}</td>
                      <td className="text-center font-extrabold text-gold-300 text-base">{row.points}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-pitch-500 mt-3">P=Played · W=Won · D=Drawn · L=Lost · GF/GA=Goals · GD=Diff · Pts=Points</p>
        </>
      )}
    </div>
  )
}

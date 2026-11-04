import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart2, Trophy } from 'lucide-react'
import { getStandings } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Alert } from '../../components/ui/Alert'

export default function StandingsPage() {
  const [standings, setStandings] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    getStandings()
      .then(d => setStandings(d ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BarChart2 className="h-6 w-6 text-gold-400" />
          <h1 className="text-2xl font-extrabold text-white">Standings</h1>
        </div>
        <div className="gold-bar w-12" />
        <p className="text-sm text-pitch-400 mt-2">Updated automatically after each match</p>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : standings.length === 0 ? (
        <EmptyState icon={BarChart2} title="No standings yet"
          description="Standings will appear once matches have been played."
          action={<Link to="/fixtures" className="btn-outline">View Fixtures</Link>} />
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <caption className="sr-only">Tournament standings</caption>
              <thead>
                <tr>
                  <th className="pl-5">#</th><th>Team</th>
                  <th className="text-center">P</th><th className="text-center">W</th>
                  <th className="text-center">D</th><th className="text-center">L</th>
                  <th className="text-center">GF</th><th className="text-center">GA</th>
                  <th className="text-center">GD</th>
                  <th className="text-center text-gold-300">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const gd  = row.goals_for - row.goals_against
                  const cls = gd > 0 ? 'text-green-400' : gd < 0 ? 'text-red-400' : 'text-pitch-400'
                  return (
                    <tr key={row.team_id} className={i === 0 ? 'border-l-2 border-l-gold-500' : ''}>
                      <td className="pl-5 font-bold text-pitch-300">
                        {i === 0 ? <Trophy className="h-4 w-4 text-gold-400 inline" aria-label="1st" /> : i + 1}
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
                      <td className={`text-center font-semibold ${cls}`}>{gd > 0 ? '+' : ''}{gd}</td>
                      <td className="text-center font-extrabold text-gold-300 text-base">{row.points}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 text-xs text-pitch-500">
            <span>P=Played</span><span>W=Won</span><span>D=Drawn</span><span>L=Lost</span>
            <span>GF=Goals For</span><span>GA=Goals Against</span><span>GD=Goal Diff</span>
            <span className="text-gold-500">Pts=Points (W=3, D=1)</span>
          </div>
        </>
      )}
    </div>
  )
}

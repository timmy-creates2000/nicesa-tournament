import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, ClipboardList, Shuffle, CalendarDays, BarChart2,
  Trophy, AlertTriangle,
} from 'lucide-react'
import { useRegistrationSummary } from '../../hooks/useRegistrationSummary'
import { useTournament } from '../../context/TournamentContext'
import { setRegistrationPhase, getDraws } from '../../lib/api'
import { LevelBadge, StatusBadge } from '../../components/ui/Badge'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'

const LEVELS = ['100', '200', '300', '400', '500']

function StatCard({ icon: Icon, value, label, sublabel, linkTo, accent }) {
  const inner = (
    <div className={`card p-5 hover:border-pitch-600/70 transition-colors ${accent ? 'border-gold-700/40' : ''}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl
                      mb-3 ${accent ? 'bg-gold-900/30' : 'bg-pitch-800'}">
        <Icon className={`h-5 w-5 ${accent ? 'text-gold-400' : 'text-pitch-300'}`} aria-hidden />
      </div>
      <p className={`text-3xl font-extrabold ${accent ? 'text-gold-300' : 'text-white'}`}>{value}</p>
      <p className="text-sm font-medium text-pitch-200 mt-0.5">{label}</p>
      {sublabel && <p className="text-xs text-pitch-400 mt-0.5">{sublabel}</p>}
    </div>
  )
  return linkTo ? <Link to={linkTo}>{inner}</Link> : inner
}

function RegistrationToggle({ phase, onToggle, loading }) {
  const isOpen = phase === 'registration_open'
  const canToggle = ['registration_open', 'registration_closed', 'setup'].includes(phase)
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-white mb-1">Registration</p>
          <StatusBadge status={isOpen ? 'confirmed' : 'withdrawn'} />
        </div>
        <button
          onClick={onToggle}
          disabled={loading || !canToggle}
          aria-label={isOpen ? 'Close registration' : 'Open registration'}
          aria-pressed={isOpen}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors
            ${isOpen ? 'bg-green-600' : 'bg-pitch-600'} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform
            ${isOpen ? 'translate-x-8' : 'translate-x-1'}`} />
        </button>
      </div>
      <p className="text-xs text-pitch-400">
        {isOpen ? 'Students can currently register. Toggle to close.'
          : phase === 'setup' ? 'Tournament in setup. Toggle to open registration.'
          : 'Registration is closed.'}
      </p>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { settings, refresh: refreshSettings } = useTournament()
  const { summary, total, loading: summaryLoading } = useRegistrationSummary()
  const [draws,       setDraws]       = useState([])
  const [drawsLoading,setDrawsLoading]= useState(true)
  const [toggling,    setToggling]    = useState(false)
  const [toggleError, setToggleError] = useState('')

  useEffect(() => {
    getDraws()
      .then(d => setDraws(d ?? []))
      .catch(() => {})
      .finally(() => setDrawsLoading(false))
  }, [])

  async function handleToggle() {
    if (!settings) return
    setToggling(true); setToggleError('')
    try {
      await setRegistrationPhase(settings.phase !== 'registration_open')
      await refreshSettings()
    } catch (err) {
      setToggleError(err.message)
    } finally {
      setToggling(false)
    }
  }

  const latestDraw  = draws.find(d => d.status === 'published') ?? draws[0]
  const draftExists = draws.some(d => d.status === 'draft')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
        <p className="text-sm text-pitch-400">
          Tournament phase:{' '}
          <span className="text-gold-300 font-medium">
            {settings?.phase?.replace(/_/g, ' ') ?? '…'}
          </span>
        </p>
      </div>

      {toggleError && <Alert variant="error" className="mb-4" dismissible>{toggleError}</Alert>}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users}        value={summaryLoading ? '…' : total}
          label="Total Registrations" linkTo="/admin/registrations" accent />
        <StatCard icon={Shuffle}      value={drawsLoading ? '…' : draws.length}
          label="Draws Generated"     sublabel={draftExists ? 'Draft pending' : undefined}
          linkTo="/admin/draw" />
        <StatCard icon={CalendarDays} value={latestDraw?.total_teams ?? '—'}
          label="Teams in Draw"       sublabel={latestDraw ? `Draw: ${latestDraw.status}` : 'No draw yet'}
          linkTo="/admin/draw" />
        <StatCard icon={Trophy}       value={settings?.edition ?? '—'}
          label="Tournament Edition" />
      </div>

      {/* Toggle + level breakdown */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <RegistrationToggle phase={settings?.phase} onToggle={handleToggle} loading={toggling} />

        <div className="card p-5 lg:col-span-2">
          <p className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-3">
            Registrations by Level
          </p>
          {summaryLoading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {LEVELS.map(level => {
                const row   = summary.find(r => r.level === level)
                const count = row ? Number(row.confirmed_count) : 0
                const pct   = total ? Math.round((count / total) * 100) : 0
                return (
                  <div key={level} className="text-center">
                    <LevelBadge level={level} />
                    <p className="text-xl font-bold text-white mt-2">{count}</p>
                    <div className="mt-1 h-1 rounded-full bg-pitch-700 overflow-hidden">
                      <div className="h-full bg-gold-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-pitch-500 mt-0.5">{pct}%</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: Users,         label: 'Student List',     sub: 'Upload CSV, view approved students',     to: '/admin/students'       },
          { icon: ClipboardList, label: 'Registrations',    sub: 'Search, filter and export sign-ups',     to: '/admin/registrations'  },
          { icon: Shuffle,       label: 'Team Draw',        sub: 'Generate, preview and publish the draw', to: '/admin/draw'           },
          { icon: CalendarDays,  label: 'Fixtures',         sub: 'Create fixtures and enter scores',       to: '/admin/fixtures'       },
          { icon: BarChart2,     label: 'Standings',        sub: 'Live league table',                      to: '/admin/standings'      },
          { icon: ClipboardList, label: 'Audit Log',        sub: 'Full history of admin actions',          to: '/admin/audit'          },
        ].map(({ icon: Icon, label, sub, to }) => (
          <Link key={to} to={to} className="card p-5 hover:border-pitch-600/70 transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pitch-800 group-hover:bg-pitch-700 transition-colors">
                <Icon className="h-4 w-4 text-gold-400" aria-hidden />
              </div>
              <p className="font-semibold text-white text-sm">{label}</p>
            </div>
            <p className="text-xs text-pitch-400">{sub}</p>
          </Link>
        ))}
      </div>

      {draftExists && (
        <Alert variant="warning" className="mt-6">
          <strong>Unpublished draw pending.</strong>{' '}
          <Link to="/admin/draw" className="underline text-yellow-300">Review and publish →</Link>
        </Alert>
      )}
    </div>
  )
}

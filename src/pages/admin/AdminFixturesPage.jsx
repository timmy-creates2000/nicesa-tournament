import { useEffect, useState } from 'react'
import { Plus, Pencil, CalendarDays, Check, X } from 'lucide-react'
import { getFixtures, upsertFixture, updateScore, getDrawTeams, getDraws } from '../../lib/api'
import { StatusBadge } from '../../components/ui/Badge'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { format } from 'date-fns'

function ScoreEntry({ fixture, onSave, onCancel }) {
  const [home, setHome] = useState(fixture.home_score ?? '')
  const [away, setAway] = useState(fixture.away_score ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    if (home === '' || away === '' || isNaN(Number(home)) || isNaN(Number(away))) {
      setErr('Enter valid scores.'); return
    }
    setSaving(true)
    try { await onSave(fixture.id, Number(home), Number(away)) }
    catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-red-400">{err}</span>}
      <input type="number" min={0} value={home} onChange={e => setHome(e.target.value)}
        className="input w-14 text-center text-sm py-1" aria-label="Home score" />
      <span className="text-pitch-400">–</span>
      <input type="number" min={0} value={away} onChange={e => setAway(e.target.value)}
        className="input w-14 text-center text-sm py-1" aria-label="Away score" />
      <button onClick={handleSave} disabled={saving} className="btn-gold py-1 px-2">
        {saving ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
      </button>
      <button onClick={onCancel} className="btn-outline py-1 px-2"><X className="h-4 w-4" /></button>
    </div>
  )
}

function FixtureRow({ fixture, onScoreUpdate }) {
  const [editing, setEditing] = useState(false)
  return (
    <tr>
      <td>{fixture.round}</td>
      <td className="font-medium text-white">{fixture.home_team?.team_name}</td>
      <td>
        {editing ? (
          <ScoreEntry fixture={fixture}
            onSave={async (id, h, a) => { await onScoreUpdate(id, h, a); setEditing(false) }}
            onCancel={() => setEditing(false)} />
        ) : fixture.status === 'completed' ? (
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{fixture.home_score} – {fixture.away_score}</span>
            <button onClick={() => setEditing(true)} className="text-pitch-400 hover:text-white transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="btn-outline text-xs py-1 px-2 gap-1">
            <Pencil className="h-3 w-3" /> Enter Score
          </button>
        )}
      </td>
      <td className="font-medium text-white">{fixture.away_team?.team_name}</td>
      <td>{fixture.scheduled_at ? format(new Date(fixture.scheduled_at), 'dd MMM · HH:mm') : '—'}</td>
      <td>{fixture.venue ?? '—'}</td>
      <td><StatusBadge status={fixture.status} /></td>
    </tr>
  )
}

function CreateFixtureModal({ open, onClose, teams, drawId, onCreated }) {
  const [home, setHome]         = useState('')
  const [away, setAway]         = useState('')
  const [round, setRound]       = useState(1)
  const [venue, setVenue]       = useState('')
  const [scheduled, setScheduled] = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  async function handleCreate() {
    if (!home || !away || home === away) { setErr('Select two different teams.'); return }
    setSaving(true); setErr('')
    try {
      await upsertFixture({ draw_id: drawId, home_team_id: home, away_team_id: away,
        round: Number(round), match_number: Date.now(),
        venue: venue || null, scheduled_at: scheduled || null })
      onCreated(); onClose()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Fixture" size="sm">
      {err && <Alert variant="error" className="mb-3">{err}</Alert>}
      <div className="space-y-3">
        <div>
          <label className="label">Round</label>
          <input type="number" min={1} value={round} onChange={e => setRound(e.target.value)} className="input text-sm" />
        </div>
        <div>
          <label className="label">Home Team</label>
          <select value={home} onChange={e => setHome(e.target.value)} className="input text-sm">
            <option value="">Select team…</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Away Team</label>
          <select value={away} onChange={e => setAway(e.target.value)} className="input text-sm">
            <option value="">Select team…</option>
            {teams.filter(t => t.id !== home).map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Venue (optional)</label>
          <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Pitch 1" className="input text-sm" />
        </div>
        <div>
          <label className="label">Scheduled Date/Time (optional)</label>
          <input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} className="input text-sm" />
        </div>
        <button onClick={handleCreate} disabled={saving} className="btn-gold w-full justify-center mt-1">
          {saving ? <Spinner size="sm" /> : 'Create Fixture'}
        </button>
      </div>
    </Modal>
  )
}

export default function AdminFixturesPage() {
  const [fixtures,    setFixtures]    = useState([])
  const [teams,       setTeams]       = useState([])
  const [drawId,      setDrawId]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [showCreate,  setShowCreate]  = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const draws = await getDraws()
      const pub   = draws.find(d => d.status === 'published') ?? draws.find(d => d.status === 'draft')
      if (pub) {
        setDrawId(pub.id)
        const [fd, td] = await Promise.all([getFixtures(pub.id), getDrawTeams(pub.id)])
        setFixtures(fd ?? []); setTeams(td ?? [])
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleScoreUpdate(id, home, away) {
    await updateScore(id, home, away); await load()
  }

  const rounds = [...new Set(fixtures.map(f => f.round))].sort((a, b) => a - b)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Fixtures</h1>
          <p className="text-sm text-pitch-400">Manage match schedule and enter scores</p>
        </div>
        <button onClick={() => setShowCreate(true)} disabled={!drawId} className="btn-gold gap-1.5">
          <Plus className="h-4 w-4" /> Add Fixture
        </button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {!drawId && !loading && (
        <Alert variant="info" className="mb-4">No draw found. Generate and publish a draw first.</Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : fixtures.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No fixtures yet"
          action={drawId ? <button onClick={() => setShowCreate(true)} className="btn-gold">Add Fixture</button> : null} />
      ) : (
        <div className="space-y-6">
          {rounds.map(round => (
            <section key={round}>
              <h2 className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-2">Round {round}</h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Rd</th><th>Home</th><th>Score</th><th>Away</th><th>Date</th><th>Venue</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {fixtures.filter(f => f.round === round).map(f => (
                      <FixtureRow key={f.id} fixture={f} onScoreUpdate={handleScoreUpdate} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <CreateFixtureModal open={showCreate} onClose={() => setShowCreate(false)}
        teams={teams} drawId={drawId} onCreated={load} />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Shuffle, Eye, Send, AlertTriangle, CheckCircle, Users, Info } from 'lucide-react'
import { generateDraw, publishDraw, getDraws, getDrawTeams } from '../../lib/api'
import { useTournament } from '../../context/TournamentContext'
import { LevelBadge, StatusBadge } from '../../components/ui/Badge'
import { Alert } from '../../components/ui/Alert'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'

function TeamPreviewCard({ team }) {
  const members  = team.members ?? team.team_members?.map(tm => ({
    full_name:     tm.registrations?.full_name,
    level:         tm.registrations?.level,
    is_substitute: tm.is_substitute,
  })) ?? []
  const starters = members.filter(m => !m.is_substitute)
  const subs     = members.filter(m =>  m.is_substitute)
  const levels   = [...new Set(members.map(m => m.level))]

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white text-sm">
          {team.team_name ?? `Team ${team.team_number}`}
        </h3>
        <div className="flex gap-1 flex-wrap">
          {levels.map(l => <LevelBadge key={l} level={l} />)}
        </div>
      </div>
      <ul className="space-y-1">
        {starters.map((m, i) => (
          <li key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-pitch-800/60">
            <span className="text-pitch-100">{m.full_name}</span>
            <LevelBadge level={m.level} />
          </li>
        ))}
        {subs.map((m, i) => (
          <li key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-pitch-800/40 opacity-70">
            <span className="text-pitch-300">{m.full_name} <span className="text-pitch-500">(sub)</span></span>
            <LevelBadge level={m.level} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AdminDrawPage() {
  const { settings, refresh: refreshSettings } = useTournament()
  const [draws,        setDraws]        = useState([])
  const [drawsLoading, setDrawsLoading] = useState(true)
  const [squadSize,    setSquadSize]    = useState(5)
  const [subSlots,     setSubSlots]     = useState(2)
  const [generating,   setGenerating]   = useState(false)
  const [preview,      setPreview]      = useState(null)
  const [showPreview,  setShowPreview]  = useState(false)
  const [selectedDraw, setSelectedDraw] = useState(null)
  const [teamRoster,   setTeamRoster]   = useState([])
  const [rosterLoading,setRosterLoading]= useState(false)
  const [publishing,   setPublishing]   = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')

  async function loadDraws() {
    setDrawsLoading(true)
    const data = await getDraws().catch(() => [])
    setDraws(data ?? [])
    setDrawsLoading(false)
  }

  useEffect(() => { loadDraws() }, [])

  async function handlePreview() {
    setError(''); setSuccess(''); setGenerating(true)
    try {
      const result = await generateDraw({ squadSize, subSlots, previewOnly: true })
      if (!result.success) throw new Error(result.message ?? result.code)
      setPreview(result); setShowPreview(true)
    } catch (err) { setError(err.message) }
    finally { setGenerating(false) }
  }

  async function handleSave() {
    setError(''); setSuccess(''); setGenerating(true)
    try {
      const result = await generateDraw({ squadSize, subSlots, previewOnly: false })
      if (!result.success) throw new Error(result.message ?? result.code)
      setSuccess(`Draft draw saved — ID: ${result.draw_id}`)
      setPreview(null); setShowPreview(false)
      await loadDraws(); await refreshSettings()
    } catch (err) { setError(err.message) }
    finally { setGenerating(false) }
  }

  async function handlePublish(drawId) {
    if (!confirm('Publish this draw? Students will immediately see their team assignments.')) return
    setPublishing(true); setError(''); setSuccess('')
    try {
      const result = await publishDraw(drawId)
      if (!result.success) throw new Error(result.message ?? result.code)
      setSuccess(`Draw published! ${result.teams_published} teams are now public.`)
      await loadDraws(); await refreshSettings()
    } catch (err) { setError(err.message) }
    finally { setPublishing(false) }
  }

  async function handleViewDraw(draw) {
    setSelectedDraw(draw); setRosterLoading(true)
    try {
      const teams = await getDrawTeams(draw.id)
      setTeamRoster(teams ?? [])
    } catch { setTeamRoster([]) }
    finally { setRosterLoading(false) }
  }

  const draftDraw     = draws.find(d => d.status === 'draft')
  const publishedDraw = draws.find(d => d.status === 'published')
  const canGenerate   = ['registration_closed', 'draw_generated'].includes(settings?.phase)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white">Team Draw</h1>
        <p className="text-sm text-pitch-400">Generate, preview and publish the official team assignments</p>
      </div>

      {error   && <Alert variant="error"   className="mb-4" dismissible>{error}</Alert>}
      {success && <Alert variant="success" className="mb-4" dismissible>{success}</Alert>}

      {!canGenerate && (
        <Alert variant="info" className="mb-5">
          Close registration first. Current phase: <strong>{settings?.phase?.replace(/_/g, ' ')}</strong>
        </Alert>
      )}

      {/* Generator panel */}
      <div className="card-elevated p-6 mb-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Shuffle className="h-5 w-5 text-gold-400" /> Generate New Draw
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="squad-size" className="label">Starting Players per Team</label>
            <input id="squad-size" type="number" min={5} max={11} value={squadSize}
              onChange={e => setSquadSize(Number(e.target.value))} className="input text-sm" />
          </div>
          <div>
            <label htmlFor="sub-slots" className="label">Substitute Slots</label>
            <input id="sub-slots" type="number" min={0} max={5} value={subSlots}
              onChange={e => setSubSlots(Number(e.target.value))} className="input text-sm" />
          </div>
        </div>
        <div className="bg-pitch-800/50 rounded-xl p-3 mb-4 flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-pitch-300">
            Players are shuffled randomly then distributed to maximise level diversity — one
            player from each level (100–500) per squad where possible.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handlePreview} disabled={generating || !canGenerate}
            className="btn-outline flex-1 justify-center gap-2">
            {generating ? <><Spinner size="sm" /> Working…</> : <><Eye className="h-4 w-4" /> Preview Draw</>}
          </button>
          <button onClick={handleSave} disabled={generating || !canGenerate}
            className="btn-primary flex-1 justify-center gap-2">
            {generating ? <><Spinner size="sm" /> Saving…</> : <><Shuffle className="h-4 w-4" /> Save Draft</>}
          </button>
        </div>
      </div>

      {/* Draft draw card */}
      {draftDraw && (
        <div className="card-elevated p-6 mb-6 border-yellow-700/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" /> Draft Draw
            </h2>
            <StatusBadge status="draft" />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            {[['Teams', draftDraw.total_teams], ['Players', draftDraw.total_players],
              ['Unassigned', draftDraw.unassigned]].map(([l, v]) => (
              <div key={l} className={`bg-pitch-800/50 rounded-xl p-3 ${l === 'Unassigned' && v > 0 ? 'border border-red-700/40' : ''}`}>
                <p className={`text-2xl font-bold ${l === 'Unassigned' && v > 0 ? 'text-red-400' : 'text-white'}`}>{v}</p>
                <p className="text-xs text-pitch-400">{l}</p>
              </div>
            ))}
          </div>
          {draftDraw.unassigned > 0 && (
            <Alert variant="warning" className="mb-3">
              {draftDraw.unassigned} player(s) could not fill a complete team. Consider adjusting squad size.
            </Alert>
          )}
          <div className="flex gap-3">
            <button onClick={() => handleViewDraw(draftDraw)} className="btn-outline flex-1 justify-center gap-2 py-2">
              <Eye className="h-4 w-4" /> View Teams
            </button>
            <button onClick={() => handlePublish(draftDraw.id)} disabled={publishing}
              className="btn-gold flex-1 justify-center gap-2 py-2">
              {publishing ? <><Spinner size="sm" /> Publishing…</> : <><Send className="h-4 w-4" /> Publish</>}
            </button>
          </div>
        </div>
      )}

      {/* Published draw card */}
      {publishedDraw && (
        <div className="card p-5 mb-6 border-gold-700/30">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" /> Published Draw
            </h2>
            <StatusBadge status="published" />
          </div>
          <p className="text-xs text-pitch-400 mb-3">
            {publishedDraw.total_teams} teams · {publishedDraw.total_players} players
          </p>
          <button onClick={() => handleViewDraw(publishedDraw)} className="btn-outline text-sm gap-1.5 py-1.5">
            <Eye className="h-4 w-4" /> View Published Teams
          </button>
        </div>
      )}

      {/* Draw history */}
      {draws.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-white mb-3">Draw History</h2>
          {drawsLoading ? <div className="flex justify-center py-4"><Spinner /></div> : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Status</th><th>Teams</th><th>Players</th><th>Unassigned</th><th></th></tr></thead>
                <tbody>
                  {draws.map(d => (
                    <tr key={d.id}>
                      <td><StatusBadge status={d.status} /></td>
                      <td>{d.total_teams}</td>
                      <td>{d.total_players}</td>
                      <td className={d.unassigned > 0 ? 'text-red-400 font-semibold' : ''}>{d.unassigned}</td>
                      <td>
                        <button onClick={() => handleViewDraw(d)} className="btn-outline text-xs py-1 px-2 gap-1">
                          <Eye className="h-3 w-3" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Draw Preview" size="xl">
        {preview && (
          <div>
            <div className="grid grid-cols-3 gap-3 text-center mb-5">
              {[['Teams', preview.total_teams], ['Players', preview.total_players],
                ['Unassigned', preview.unassigned_count]].map(([l, v]) => (
                <div key={l} className="bg-pitch-800/50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-white">{v}</p>
                  <p className="text-xs text-pitch-400">{l}</p>
                </div>
              ))}
            </div>
            {preview.unassigned?.length > 0 && (
              <Alert variant="warning" className="mb-4">
                <strong>{preview.unassigned_count} unassigned:</strong>
                <ul className="mt-1 list-disc list-inside text-xs">
                  {preview.unassigned.map((u, i) => <li key={i}>{u.full_name} ({u.level}L)</li>)}
                </ul>
              </Alert>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
              {preview.teams?.map((t, i) => <TeamPreviewCard key={i} team={t} />)}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowPreview(false); handleSave() }}
                className="btn-gold flex-1 justify-center gap-2">
                <Shuffle className="h-4 w-4" /> Save as Draft
              </button>
              <button onClick={() => setShowPreview(false)} className="btn-outline px-6">Discard</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Roster modal */}
      <Modal open={!!selectedDraw} onClose={() => { setSelectedDraw(null); setTeamRoster([]) }}
        title={selectedDraw ? `${selectedDraw.status === 'published' ? 'Published' : 'Draft'} Draw — Teams` : ''}
        size="xl">
        {rosterLoading ? <div className="flex justify-center py-8"><Spinner size="lg" /></div> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {teamRoster.map(t => <TeamPreviewCard key={t.id} team={t} />)}
          </div>
        )}
      </Modal>
    </div>
  )
}

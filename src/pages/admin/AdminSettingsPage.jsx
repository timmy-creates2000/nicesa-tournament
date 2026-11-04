import { useState, useEffect } from 'react'
import { Settings, Save, Megaphone, AlertTriangle } from 'lucide-react'
import { useTournament } from '../../context/TournamentContext'
import { updateAnnouncement, updateSettings } from '../../lib/api'
import { Alert } from '../../components/ui/Alert'
import { StatusBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'

const PHASES = [
  'setup', 'registration_open', 'registration_closed',
  'draw_generated', 'draw_published', 'in_progress', 'completed',
]

export default function AdminSettingsPage() {
  const { settings, refresh } = useTournament()

  const [announcement, setAnnouncement] = useState('')
  const [savingAnn,    setSavingAnn]    = useState(false)
  const [annMsg,       setAnnMsg]       = useState(null)   // { type, text }

  const [phase,        setPhase]        = useState('')
  const [savingPhase,  setSavingPhase]  = useState(false)
  const [phaseMsg,     setPhaseMsg]     = useState(null)

  useEffect(() => {
    if (settings) { setAnnouncement(settings.announcement ?? ''); setPhase(settings.phase) }
  }, [settings])

  async function handleSaveAnnouncement(e) {
    e.preventDefault(); setSavingAnn(true); setAnnMsg(null)
    try {
      await updateAnnouncement(announcement); await refresh()
      setAnnMsg({ type: 'success', text: 'Announcement updated.' })
    } catch (err) { setAnnMsg({ type: 'error', text: err.message }) }
    finally { setSavingAnn(false) }
  }

  async function handlePhaseChange() {
    if (!confirm(`Change tournament phase to "${phase.replace(/_/g, ' ')}"?`)) return
    setSavingPhase(true); setPhaseMsg(null)
    try {
      await updateSettings({ phase }); await refresh()
      setPhaseMsg({ type: 'success', text: 'Phase updated.' })
    } catch (err) { setPhaseMsg({ type: 'error', text: err.message }) }
    finally { setSavingPhase(false) }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white">Settings</h1>
        <p className="text-sm text-pitch-400">Manage tournament configuration and announcements</p>
      </div>

      {/* Announcement */}
      <div className="card-elevated p-6 mb-5">
        <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-gold-400" /> Public Announcement
        </h2>
        <p className="text-xs text-pitch-400 mb-4">Displayed as a banner on the homepage. Leave empty to hide.</p>
        {annMsg && <Alert variant={annMsg.type} className="mb-3" dismissible>{annMsg.text}</Alert>}
        <form onSubmit={handleSaveAnnouncement}>
          <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)}
            rows={3} maxLength={500} placeholder="e.g. Registration closes Friday 10 PM!"
            className="input resize-none mb-3" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-pitch-500">{announcement.length}/500</span>
            <button type="submit" disabled={savingAnn} className="btn-gold gap-1.5">
              {savingAnn ? <Spinner size="sm" /> : <Save className="h-4 w-4" />} Save
            </button>
          </div>
        </form>
      </div>

      {/* Phase */}
      <div className="card-elevated p-6 mb-5">
        <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
          <Settings className="h-4 w-4 text-gold-400" /> Tournament Phase
        </h2>
        <div className="flex items-center gap-2 text-xs text-pitch-400 mb-4">
          Current: <StatusBadge status={settings?.phase ?? 'setup'} />
        </div>
        {phaseMsg && <Alert variant={phaseMsg.type} className="mb-3" dismissible>{phaseMsg.text}</Alert>}
        <div className="flex flex-wrap gap-2 mb-4">
          {PHASES.map(p => (
            <button key={p} onClick={() => setPhase(p)} aria-pressed={phase === p}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${phase === p ? 'bg-gold-500 text-pitch-950' : 'bg-pitch-800 text-pitch-300 hover:bg-pitch-700'}`}>
              {p.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePhaseChange} disabled={savingPhase || phase === settings?.phase}
            className="btn-primary gap-1.5">
            {savingPhase ? <Spinner size="sm" /> : <Save className="h-4 w-4" />} Apply Phase
          </button>
          {phase !== settings?.phase && (
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Unsaved change
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      {settings && (
        <div className="card p-5">
          <h2 className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-3">Tournament Info</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Name',       settings.name],
              ['Edition',    settings.edition],
              ['Squad Size', `${settings.squad_size} starters + ${settings.substitute_slots} subs`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-pitch-700/30 pb-2">
                <dt className="text-pitch-400">{k}</dt>
                <dd className="text-white font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

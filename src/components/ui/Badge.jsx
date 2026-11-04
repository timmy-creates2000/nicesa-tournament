/** Level badge colours */
const levelColours = {
  '100': 'bg-blue-900/60   text-blue-200   border-blue-700/50',
  '200': 'bg-purple-900/60 text-purple-200 border-purple-700/50',
  '300': 'bg-pitch-800/60  text-pitch-200  border-pitch-600/50',
  '400': 'bg-gold-900/60   text-gold-200   border-gold-700/50',
  '500': 'bg-red-900/60    text-red-200    border-red-700/50',
}

export function LevelBadge({ level }) {
  const cls = levelColours[String(level)] ?? 'bg-pitch-800 text-pitch-200 border-pitch-600'
  return (
    <span className={`level-badge border ${cls}`} aria-label={`Level ${level}`}>
      {level}L
    </span>
  )
}

/** Generic status badge */
const statusColours = {
  confirmed:    'bg-green-900/60  text-green-200  border-green-700/50',
  pending:      'bg-yellow-900/60 text-yellow-200 border-yellow-700/50',
  withdrawn:    'bg-red-900/60    text-red-200    border-red-700/50',
  published:    'bg-gold-900/60   text-gold-200   border-gold-700/50',
  draft:        'bg-pitch-800/60  text-pitch-300  border-pitch-600/50',
  superseded:   'bg-pitch-900/60  text-pitch-400  border-pitch-700/50',
  scheduled:    'bg-blue-900/60   text-blue-200   border-blue-700/50',
  in_progress:  'bg-yellow-900/60 text-yellow-200 border-yellow-700/50',
  completed:    'bg-green-900/60  text-green-200  border-green-700/50',
  postponed:    'bg-orange-900/60 text-orange-200 border-orange-700/50',
  cancelled:    'bg-red-900/60    text-red-200    border-red-700/50',
  eligible:     'bg-green-900/60  text-green-200  border-green-700/50',
  ineligible:   'bg-red-900/60    text-red-200    border-red-700/50',
  suspended:    'bg-orange-900/60 text-orange-200 border-orange-700/50',
}

export function StatusBadge({ status }) {
  const cls = statusColours[status] ?? 'bg-pitch-800 text-pitch-200 border-pitch-600'
  return (
    <span className={`status-pill border ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {status.replace(/_/g, ' ')}
    </span>
  )
}

import { useParams, useLocation, Link, Navigate } from 'react-router-dom'
import { CheckCircle, Users, CalendarDays, Trophy, Download } from 'lucide-react'
import { LevelBadge } from '../../components/ui/Badge'
import { format } from 'date-fns'

export default function ConfirmationPage() {
  const { registrationId } = useParams()
  const { state } = useLocation()

  // If someone navigates directly without registration state, send them to register
  if (!state?.full_name) {
    return <Navigate to="/register" replace />
  }

  const { full_name, level, registered_at, matric_number } = state

  function handlePrint() {
    window.print()
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg animate-slide-up">
        {/* Success icon */}
        <div className="text-center mb-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full
                          bg-green-950/60 border-2 border-green-500/50 mb-4">
            <CheckCircle className="h-10 w-10 text-green-400" aria-hidden />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">You're Registered!</h1>
          <p className="text-pitch-300 text-sm">
            Your spot in the NICESA 5-a-Side Tournament is confirmed.
          </p>
        </div>

        {/* Confirmation card */}
        <div className="card-elevated overflow-hidden">
          {/* Gold top bar */}
          <div className="gold-bar h-1" aria-hidden />

          <div className="p-6">
            <h2 className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-4">
              Registration Details
            </h2>

            <dl className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-pitch-700/40">
                <dt className="text-sm text-pitch-300">Name</dt>
                <dd className="text-sm font-semibold text-white">{full_name}</dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-pitch-700/40">
                <dt className="text-sm text-pitch-300">Matric Number</dt>
                <dd className="text-sm font-mono text-white tracking-wider">{matric_number}</dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-pitch-700/40">
                <dt className="text-sm text-pitch-300">Level</dt>
                <dd><LevelBadge level={level} /></dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-pitch-700/40">
                <dt className="text-sm text-pitch-300">Registration ID</dt>
                <dd className="text-xs font-mono text-pitch-400 max-w-[180px] truncate">{registrationId}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-sm text-pitch-300">Registered</dt>
                <dd className="text-sm text-pitch-200">
                  {registered_at
                    ? format(new Date(registered_at), 'dd MMM yyyy, HH:mm')
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Next steps */}
          <div className="bg-pitch-800/50 px-6 py-5 border-t border-pitch-700/40">
            <h3 className="text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-3">
              What happens next
            </h3>
            <ul className="space-y-2.5" role="list">
              {[
                { icon: Users,       text: 'Wait for the official team draw to be published by the tournament committee.' },
                { icon: Trophy,      text: 'Check your assigned team on the My Team page once the draw is live.' },
                { icon: CalendarDays,text: 'Fixtures will be announced — keep an eye on the Fixtures page.' },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-pitch-200">
                  <Icon className="h-4 w-4 text-gold-400 mt-0.5 shrink-0" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <Link to="/dashboard" className="btn-gold flex-1 justify-center py-2.5">
            <Users className="h-4 w-4" aria-hidden /> My Team Dashboard
          </Link>
          <button onClick={handlePrint} className="btn-outline flex-1 justify-center py-2.5">
            <Download className="h-4 w-4" aria-hidden /> Save / Print
          </button>
        </div>

        <p className="text-center text-xs text-pitch-600 mt-4">
          Screenshot or print this page as your registration reference.
        </p>
      </div>
    </div>
  )
}

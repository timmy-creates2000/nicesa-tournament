import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6">
        <Trophy className="h-16 w-16 text-pitch-700 mx-auto mb-4" aria-hidden />
        <h1 className="text-6xl font-extrabold text-pitch-700 mb-2">404</h1>
        <h2 className="text-xl font-bold text-white mb-3">Page Not Found</h2>
        <p className="text-pitch-400 text-sm max-w-xs">
          That page doesn't exist. Maybe the referee showed it a red card.
        </p>
      </div>
      <Link to="/" className="btn-gold">Back to Home</Link>
    </div>
  )
}

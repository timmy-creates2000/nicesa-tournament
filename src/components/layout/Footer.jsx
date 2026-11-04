import { Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-pitch-800/60 bg-pitch-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pitch-800 border border-gold-600/30">
              <Trophy className="h-4 w-4 text-gold-400" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-bold text-white">NICESA</p>
              <p className="text-[10px] text-pitch-500">Inter-Level Football Tournament</p>
            </div>
          </div>

          {/* Links */}
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-pitch-400">
              <li><Link to="/"          className="hover:text-pitch-200 transition-colors">Home</Link></li>
              <li><Link to="/register"  className="hover:text-pitch-200 transition-colors">Register</Link></li>
              <li><Link to="/fixtures"  className="hover:text-pitch-200 transition-colors">Fixtures</Link></li>
              <li><Link to="/standings" className="hover:text-pitch-200 transition-colors">Standings</Link></li>
            </ul>
          </nav>

          {/* Copyright */}
          <p className="text-xs text-pitch-600">
            &copy; {year} NICESA Civil Engineering Students Association
          </p>
        </div>
      </div>
    </footer>
  )
}

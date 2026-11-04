import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, Trophy, Shield, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTournament } from '../../context/TournamentContext'

const navLinks = [
  { to: '/',          label: 'Home'       },
  { to: '/register',  label: 'Register'   },
  { to: '/dashboard', label: 'My Team'    },
  { to: '/fixtures',  label: 'Fixtures'   },
  { to: '/standings', label: 'Standings'  },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAdminUser, user, signOut } = useAuth()
  const { settings } = useTournament()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const activeCls   = 'text-gold-400 font-semibold'
  const inactiveCls = 'text-pitch-200 hover:text-white transition-colors'

  return (
    <header className="sticky top-0 z-40 bg-pitch-950/95 backdrop-blur-md border-b border-pitch-800/60">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group"
            aria-label="NICESA Tournament home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pitch-800 border border-gold-600/40 group-hover:border-gold-400/70 transition-colors">
              <Trophy className="h-5 w-5 text-gold-400" aria-hidden />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-extrabold text-white leading-tight tracking-wide">NICESA</p>
              <p className="text-[10px] text-pitch-400 leading-tight">Football Tournament</p>
            </div>
          </Link>

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-6" role="list">
            {navLinks.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => `text-sm ${isActive ? activeCls : inactiveCls}`}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isAdminUser ? (
              <div className="hidden md:flex items-center gap-3">
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 text-sm text-gold-300 hover:text-gold-200 font-medium transition-colors"
                >
                  <Shield className="h-4 w-4" aria-hidden />
                  Admin
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 text-sm text-pitch-300 hover:text-white transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                to="/admin/login"
                className="hidden md:flex items-center gap-1.5 text-xs text-pitch-500 hover:text-pitch-300 transition-colors"
              >
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Admin
              </Link>
            )}

            {/* Phase indicator chip */}
            {settings && (
              <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full
                               bg-pitch-800 border border-pitch-700 px-3 py-1 text-xs text-pitch-300">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    settings.phase === 'registration_open' ? 'bg-green-400' :
                    settings.phase === 'draw_published'    ? 'bg-gold-400'  :
                    'bg-pitch-500'
                  }`}
                  aria-hidden
                />
                {settings.phase.replace(/_/g, ' ')}
              </span>
            )}

            {/* Mobile toggle */}
            <button
              className="md:hidden text-pitch-300 hover:text-white transition-colors"
              onClick={() => setMobileOpen(o => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            id="mobile-menu"
            className="md:hidden border-t border-pitch-800/60 py-3 pb-4 animate-fade-in"
          >
            <ul className="space-y-1" role="list">
              {navLinks.map(({ to, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-lg text-sm ${isActive
                        ? 'bg-pitch-800 text-gold-400 font-semibold'
                        : 'text-pitch-200 hover:bg-pitch-800/50 hover:text-white'
                      } transition-colors`
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    {label}
                  </NavLink>
                </li>
              ))}

              <li className="pt-2 border-t border-pitch-800 mt-2">
                {isAdminUser ? (
                  <>
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gold-300 hover:bg-pitch-800/50"
                      onClick={() => setMobileOpen(false)}
                    >
                      <Shield className="h-4 w-4" /> Admin Dashboard
                    </Link>
                    <button
                      onClick={() => { handleSignOut(); setMobileOpen(false) }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-pitch-300 hover:bg-pitch-800/50 w-full text-left"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    to="/admin/login"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-pitch-400 hover:bg-pitch-800/50"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Shield className="h-4 w-4" /> Admin Login
                  </Link>
                )}
              </li>
            </ul>
          </div>
        )}
      </nav>
    </header>
  )
}

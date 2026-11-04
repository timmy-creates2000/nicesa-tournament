import { useState } from 'react'
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import {
  Trophy, LayoutDashboard, Users, Shuffle, CalendarDays,
  BarChart2, ClipboardList, Settings, LogOut, Menu, X, Shield,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTournament } from '../../context/TournamentContext'

const adminNav = [
  { to: '/admin',              label: 'Dashboard',    Icon: LayoutDashboard, end: true },
  { to: '/admin/students',     label: 'Students',     Icon: Users            },
  { to: '/admin/registrations',label: 'Registrations',Icon: ClipboardList    },
  { to: '/admin/draw',         label: 'Team Draw',    Icon: Shuffle          },
  { to: '/admin/fixtures',     label: 'Fixtures',     Icon: CalendarDays     },
  { to: '/admin/standings',    label: 'Standings',    Icon: BarChart2        },
  { to: '/admin/audit',        label: 'Audit Log',    Icon: ClipboardList    },
  { to: '/admin/settings',     label: 'Settings',     Icon: Settings         },
]

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, signOut } = useAuth()
  const { settings } = useTournament()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
      isActive
        ? 'bg-pitch-700/80 text-gold-300 border border-pitch-600/50'
        : 'text-pitch-300 hover:bg-pitch-800/60 hover:text-white'
    }`

  const Sidebar = () => (
    <aside
      className="flex flex-col h-full bg-pitch-900 border-r border-pitch-800/60"
      aria-label="Admin navigation"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-pitch-800/60">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pitch-800 border border-gold-600/40">
          <Shield className="h-5 w-5 text-gold-400" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Admin Panel</p>
          <p className="text-[10px] text-pitch-500 truncate max-w-[120px]">{user?.email}</p>
        </div>
      </div>

      {/* Phase badge */}
      {settings && (
        <div className="mx-4 mt-3 mb-1">
          <span className="flex items-center gap-1.5 text-[10px] text-pitch-400 uppercase tracking-wider">
            Phase:
            <span className="text-gold-300 font-semibold normal-case">
              {settings.phase.replace(/_/g, ' ')}
            </span>
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {adminNav.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkCls}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: public site link + sign out */}
      <div className="px-3 py-3 border-t border-pitch-800/60 space-y-1">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-pitch-400 hover:text-white hover:bg-pitch-800/60 transition-all"
        >
          <Trophy className="h-4 w-4" aria-hidden />
          Public Site
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-pitch-400 hover:text-red-300 hover:bg-red-950/40 transition-all"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign Out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-pitch-950 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-56 shrink-0 flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <div className="relative w-56 flex flex-col z-10">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-pitch-800/60 bg-pitch-900">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-pitch-400 hover:text-white transition-colors"
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-white">Admin Panel</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" id="admin-main-content">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

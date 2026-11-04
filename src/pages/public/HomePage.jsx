import { Link } from 'react-router-dom'
import {
  Trophy, Users, Shuffle, CalendarDays, ChevronRight,
  Megaphone, CheckCircle, Clock, Star,
} from 'lucide-react'
import { useTournament } from '../../context/TournamentContext'
import { useRegistrationSummary } from '../../hooks/useRegistrationSummary'
import { LevelBadge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'

const LEVELS = ['100', '200', '300', '400', '500']

const phaseInfo = {
  setup:               { label: 'Coming Soon',          colour: 'text-pitch-400', dot: 'bg-pitch-500'  },
  registration_open:   { label: 'Registration Open',    colour: 'text-green-400', dot: 'bg-green-400'  },
  registration_closed: { label: 'Registration Closed',  colour: 'text-yellow-400',dot: 'bg-yellow-400' },
  draw_generated:      { label: 'Draw Generated',       colour: 'text-blue-400',  dot: 'bg-blue-400'   },
  draw_published:      { label: 'Draw Published',       colour: 'text-gold-400',  dot: 'bg-gold-400'   },
  in_progress:         { label: 'Tournament Underway',  colour: 'text-green-400', dot: 'bg-green-400'  },
  completed:           { label: 'Tournament Complete',  colour: 'text-pitch-300', dot: 'bg-pitch-400'  },
}

function HeroSection({ settings }) {
  const phase = phaseInfo[settings?.phase] ?? phaseInfo.setup
  const isOpen = settings?.phase === 'registration_open'

  return (
    <section
      className="relative overflow-hidden bg-pitch-gradient pitch-texture py-20 md:py-32"
      aria-labelledby="hero-heading"
    >
      {/* Decorative background circles */}
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-pitch-800/30 blur-3xl" aria-hidden />
      <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-gold-900/10 blur-3xl"  aria-hidden />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
        {/* Trophy icon */}
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-full
                        bg-pitch-800/80 border-2 border-gold-500/50 mb-6 shadow-xl shadow-black/40">
          <Trophy className="h-10 w-10 text-gold-400" aria-hidden />
        </div>

        {/* Status chip */}
        <div className="flex justify-center mb-4">
          <span className={`inline-flex items-center gap-2 rounded-full bg-pitch-800/60
                           border border-pitch-700/50 px-4 py-1.5 text-sm font-medium ${phase.colour}`}>
            <span className={`h-2 w-2 rounded-full ${phase.dot} animate-pulse`} aria-hidden />
            {phase.label}
          </span>
        </div>

        <h1
          id="hero-heading"
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white text-shadow leading-tight mb-4"
        >
          NICESA Inter-Level
          <span className="block text-gold-400">5-a-Side Football</span>
        </h1>

        <p className="text-lg text-pitch-200 max-w-2xl mx-auto mb-8">
          The official inter-level football tournament for{' '}
          <strong className="text-white">Civil Engineering students</strong> —
          100 Level through 500 Level compete for departmental glory.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isOpen ? (
            <Link to="/register" className="btn-gold text-base px-8 py-3">
              Register Now <ChevronRight className="h-5 w-5" aria-hidden />
            </Link>
          ) : (
            <Link to="/standings" className="btn-gold text-base px-8 py-3">
              View Standings <ChevronRight className="h-5 w-5" aria-hidden />
            </Link>
          )}
          <Link to="/fixtures" className="btn-outline text-base px-8 py-3">
            View Fixtures
          </Link>
        </div>

        {settings?.edition && (
          <p className="mt-6 text-xs text-pitch-500">{settings.edition} Edition</p>
        )}
      </div>
    </section>
  )
}

function AnnouncementBanner({ settings }) {
  if (!settings?.announcement) return null
  return (
    <section
      className="bg-gold-900/20 border-y border-gold-800/30 py-4"
      aria-label="Latest announcement"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-start sm:items-center gap-3">
          <Megaphone className="h-5 w-5 text-gold-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden />
          <div>
            <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider mr-2">
              Announcement
            </span>
            <span className="text-sm text-pitch-100">{settings.announcement}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function RegistrationStats() {
  const { summary, total, loading } = useRegistrationSummary()

  return (
    <section aria-labelledby="stats-heading" className="py-12 bg-pitch-900/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="stats-heading" className="text-center text-sm font-semibold text-pitch-400 uppercase tracking-widest mb-8">
          Registration Totals by Level
        </h2>

        {loading ? (
          <div className="flex justify-center"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Total card */}
            <div className="card-elevated p-4 text-center sm:col-span-1 lg:col-span-1
                            border-gold-700/30 bg-gold-950/30">
              <p className="text-3xl font-extrabold text-gold-300">{total}</p>
              <p className="text-xs text-pitch-400 mt-1 font-medium uppercase tracking-wide">Total</p>
            </div>

            {/* Per-level cards */}
            {LEVELS.map(level => {
              const row = summary.find(r => r.level === level)
              const count = row ? Number(row.confirmed_count) : 0
              return (
                <div key={level} className="card p-4 text-center">
                  <LevelBadge level={level} />
                  <p className="text-2xl font-bold text-white mt-2">{count}</p>
                  <p className="text-[10px] text-pitch-500 mt-0.5">registered</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function HowItWorksSection() {
  const steps = [
    {
      icon: CheckCircle,
      step: '01',
      title: 'Register',
      desc: 'Enter your matric number. We verify you against the approved student list instantly.',
    },
    {
      icon: Shuffle,
      step: '02',
      title: 'The Draw',
      desc: 'Players are randomly distributed into mixed-level squads for maximum competition.',
    },
    {
      icon: CalendarDays,
      step: '03',
      title: 'Play',
      desc: 'Fixtures are published. Each squad battles through the round-robin group stage.',
    },
    {
      icon: Trophy,
      step: '04',
      title: 'Glory',
      desc: 'The top squad lifts the trophy. Live standings keep everyone in the loop.',
    },
  ]

  return (
    <section aria-labelledby="howitworks-heading" className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 id="howitworks-heading" className="text-2xl sm:text-3xl font-bold text-white mb-2">
            How it works
          </h2>
          <div className="gold-bar w-16 mx-auto" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map(({ icon: Icon, step, title, desc }) => (
            <div
              key={step}
              className="card p-6 hover:border-pitch-600/80 transition-colors group"
            >
              <div className="flex items-start gap-4 mb-3">
                <span className="text-4xl font-extrabold text-pitch-700 group-hover:text-pitch-600 transition-colors leading-none">
                  {step}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pitch-800 mt-0.5">
                  <Icon className="h-5 w-5 text-gold-400" aria-hidden />
                </div>
              </div>
              <h3 className="font-bold text-white mb-1.5">{title}</h3>
              <p className="text-sm text-pitch-300 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function LevelsSection() {
  const levelInfo = [
    { level: '100', title: '100 Level', desc: 'Fresh minds, hungry hearts' },
    { level: '200', title: '200 Level', desc: 'Building momentum'         },
    { level: '300', title: '300 Level', desc: 'Technical precision'       },
    { level: '400', title: '400 Level', desc: 'Senior experience'         },
    { level: '500', title: '500 Level', desc: 'Finishing strong'          },
  ]

  return (
    <section aria-labelledby="levels-heading" className="py-16 bg-pitch-900/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 id="levels-heading" className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Five Levels. One Trophy.
          </h2>
          <p className="text-pitch-400 text-sm">
            Civil Engineering students from every year compete as equals on the pitch.
          </p>
          <div className="gold-bar w-16 mx-auto mt-3" />
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {levelInfo.map(({ level, title, desc }) => (
            <div key={level} className="card p-5 text-center w-40 hover:border-gold-700/40 transition-colors">
              <LevelBadge level={level} />
              <p className="font-semibold text-white mt-2 text-sm">{title}</p>
              <p className="text-[11px] text-pitch-400 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection({ isOpen }) {
  return (
    <section className="py-20 bg-pitch-gradient pitch-texture" aria-labelledby="cta-heading">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
        <Star className="h-8 w-8 text-gold-400 mx-auto mb-4" aria-hidden />
        <h2 id="cta-heading" className="text-2xl sm:text-3xl font-bold text-white mb-4">
          {isOpen ? "Don't miss your spot" : "Stay in the loop"}
        </h2>
        <p className="text-pitch-200 mb-8 text-sm">
          {isOpen
            ? 'Registration is live. Grab your place before spots fill up.'
            : 'Check fixtures and standings to follow the action as it unfolds.'}
        </p>
        {isOpen ? (
          <Link to="/register" className="btn-gold text-base px-10 py-3">
            Register with Matric Number
          </Link>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/fixtures"  className="btn-gold    text-base px-8 py-3">View Fixtures</Link>
            <Link to="/standings" className="btn-outline text-base px-8 py-3">Standings</Link>
          </div>
        )}
      </div>
    </section>
  )
}

export default function HomePage() {
  const { settings, loading } = useTournament()

  return (
    <div>
      <HeroSection settings={settings} />
      <AnnouncementBanner settings={settings} />
      <RegistrationStats />
      <HowItWorksSection />
      <LevelsSection />
      <CtaSection isOpen={settings?.phase === 'registration_open'} />
    </div>
  )
}

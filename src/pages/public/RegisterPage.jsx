import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserCheck, AlertTriangle, ChevronRight, Info } from 'lucide-react'
import { registerStudent } from '../../lib/api'
import { useTournament } from '../../context/TournamentContext'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'

const ERROR_MESSAGES = {
  REGISTRATION_CLOSED: 'Registration is currently closed. Check back soon.',
  RATE_LIMITED:        'Too many attempts. Please wait a few minutes and try again.',
  INVALID_MATRIC:      "That doesn't look like a valid matric number. Please check and try again.",
  NOT_APPROVED:        'Your matric number is not on the approved student list for this tournament.',
  NOT_ELIGIBLE:        'You are listed as ineligible for this tournament. Contact the tournament administrator.',
  ALREADY_REGISTERED:  'This matric number is already registered.',
}

function MatricInput({ value, onChange, error, disabled }) {
  return (
    <div>
      <label htmlFor="matric" className="label">Matric Number</label>
      <input
        id="matric" type="text" value={value}
        onChange={e => onChange(e.target.value)} disabled={disabled}
        placeholder="e.g. CVE/2022/001" autoComplete="off"
        autoCapitalize="characters" spellCheck={false} maxLength={20}
        aria-describedby={error ? 'matric-error' : 'matric-hint'}
        className={`input font-mono tracking-wider uppercase ${error ? 'input-error' : ''}`}
      />
      {error ? (
        <p id="matric-error" className="form-error" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : (
        <p id="matric-hint" className="text-xs text-pitch-400 mt-1.5 flex items-center gap-1">
          <Info className="h-3 w-3" aria-hidden /> Enter exactly as it appears on your student ID
        </p>
      )}
    </div>
  )
}

export default function RegisterPage() {
  const { settings, isRegistrationOpen } = useTournament()
  const navigate = useNavigate()
  const [matric,      setMatric]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [fieldError,  setFieldError]  = useState('')
  const [serverError, setServerError] = useState('')

  function validate() {
    const t = matric.trim()
    if (!t)       { setFieldError('Please enter your matric number.'); return false }
    if (t.length < 5) { setFieldError('Matric number is too short.'); return false }
    setFieldError(''); return true
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    if (!validate()) return
    setLoading(true)
    try {
      const result = await registerStudent(matric)
      if (result.success) {
        navigate(`/confirmation/${result.registration_id}`, {
          state: {
            full_name: result.full_name, level: result.level,
            registered_at: result.registered_at,
            matric_number: matric.trim().toUpperCase(),
          },
        })
        return
      }
      if (result.code === 'ALREADY_REGISTERED') {
        navigate('/dashboard', { state: { matric: matric.trim().toUpperCase() } })
        return
      }
      setServerError(ERROR_MESSAGES[result.code] ?? result.message ?? 'Something went wrong.')
    } catch (err) {
      setServerError(err.message ?? 'A network error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isRegistrationOpen) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-pitch-800 p-4 border border-pitch-700">
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Registration is Closed</h1>
          <p className="text-pitch-300 text-sm mb-6">
            {['draw_published','in_progress','completed'].includes(settings?.phase)
              ? 'The draw has been published. Check your team on the dashboard.'
              : 'Registration has not opened yet. Check back later.'}
          </p>
          <div className="flex flex-col gap-2">
            {['draw_published','in_progress','completed'].includes(settings?.phase) && (
              <Link to="/dashboard" className="btn-gold w-full justify-center">View My Team</Link>
            )}
            <Link to="/" className="btn-outline w-full justify-center">Back to Home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-pitch-800 border border-gold-600/40 mb-4">
            <UserCheck className="h-7 w-7 text-gold-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1">Register to Play</h1>
          <p className="text-sm text-pitch-300">
            Enter your matric number to join the{' '}
            <span className="text-gold-300 font-medium">NICESA 5-a-Side Tournament</span>
          </p>
        </div>

        <div className="card-elevated p-7">
          <Alert variant="info" className="mb-5">
            Only <strong>Civil Engineering students</strong> on the approved list may register.
            Your level is verified automatically.
          </Alert>
          {serverError && (
            <Alert variant="error" className="mb-5" dismissible>{serverError}</Alert>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <MatricInput value={matric} onChange={v => { setMatric(v); setFieldError('') }}
              error={fieldError} disabled={loading} />
            <button type="submit" disabled={loading}
              className="btn-gold w-full justify-center mt-6 py-3 text-base">
              {loading
                ? <><Spinner size="sm" /> Verifying…</>
                : <>Register <ChevronRight className="h-5 w-5" /></>}
            </button>
          </form>
          <p className="text-center text-xs text-pitch-500 mt-5">
            Already registered?{' '}
            <Link to="/dashboard" className="text-gold-400 hover:text-gold-300 underline">
              Check your team
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

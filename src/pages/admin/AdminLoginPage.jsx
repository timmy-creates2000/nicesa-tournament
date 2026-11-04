import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../../components/ui/Spinner'
import { Alert } from '../../components/ui/Alert'

export default function AdminLoginPage() {
  const { signIn, isAdminUser, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from     = location.state?.from?.pathname ?? '/admin'

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!loading && session && isAdminUser) navigate(from, { replace: true })
  }, [session, isAdminUser, loading, navigate, from])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err.message?.toLowerCase().includes('invalid')
        ? 'Invalid email or password.'
        : (err.message ?? 'Sign-in failed. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-pitch-950"><Spinner size="lg" /></div>
  )

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-pitch-gradient pitch-texture px-4">
      <Link to="/" className="mb-8 text-sm text-pitch-400 hover:text-white transition-colors">← Public Site</Link>

      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl
                          bg-pitch-800 border-2 border-gold-600/40 mb-4 shadow-xl shadow-black/40">
            <Shield className="h-8 w-8 text-gold-400" aria-hidden />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Admin Login</h1>
          <p className="text-sm text-pitch-400 mt-1">NICESA Tournament Administration</p>
        </div>

        <div className="card-elevated p-7">
          {error && <Alert variant="error" className="mb-5" dismissible>{error}</Alert>}

          <form onSubmit={handleSubmit} noValidate aria-label="Admin login form">
            <div className="mb-4">
              <label htmlFor="admin-email" className="label">Email Address</label>
              <input id="admin-email" type="email" value={email}
                onChange={e => setEmail(e.target.value)} disabled={submitting}
                placeholder="admin@nicesa.edu" autoComplete="email" className="input" required />
            </div>

            <div className="mb-6">
              <label htmlFor="admin-password" className="label">Password</label>
              <div className="relative">
                <input id="admin-password" type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} disabled={submitting}
                  placeholder="••••••••" autoComplete="current-password" className="input pr-10" required />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pitch-400 hover:text-white transition-colors">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-gold w-full justify-center py-3 text-base">
              {submitting ? <><Spinner size="sm" /> Signing in…</> : <><Lock className="h-4 w-4" /> Sign In</>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-pitch-600 mt-6">
          Restricted to tournament administrators only.
        </p>
      </div>
    </div>
  )
}

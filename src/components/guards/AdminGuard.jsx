import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FullPageSpinner } from '../ui/Spinner'

/**
 * Protects admin routes. Redirects to /admin/login if not authenticated
 * or if the user does not have the 'admin' role in app_metadata.
 */
export function AdminGuard({ children }) {
  const { session, loading, isAdminUser } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />

  if (!session) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (!isAdminUser) {
    return <Navigate to="/" replace />
  }

  return children
}

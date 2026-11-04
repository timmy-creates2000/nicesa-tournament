import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }        from './context/AuthContext'
import { TournamentProvider }  from './context/TournamentContext'
import { PublicLayout }        from './components/layout/PublicLayout'
import { AdminLayout }         from './components/layout/AdminLayout'
import { AdminGuard }          from './components/guards/AdminGuard'

// Public pages (lazy loaded to reduce initial bundle)
import { lazy, Suspense } from 'react'
import { FullPageSpinner } from './components/ui/Spinner'

const HomePage           = lazy(() => import('./pages/public/HomePage'))
const RegisterPage       = lazy(() => import('./pages/public/RegisterPage'))
const ConfirmationPage   = lazy(() => import('./pages/public/ConfirmationPage'))
const DashboardPage      = lazy(() => import('./pages/public/DashboardPage'))
const TeamPage           = lazy(() => import('./pages/public/TeamPage'))
const FixturesPage       = lazy(() => import('./pages/public/FixturesPage'))
const StandingsPage      = lazy(() => import('./pages/public/StandingsPage'))
const NotFoundPage       = lazy(() => import('./pages/public/NotFoundPage'))

// Admin pages
const AdminLoginPage     = lazy(() => import('./pages/admin/AdminLoginPage'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminStudentsPage  = lazy(() => import('./pages/admin/AdminStudentsPage'))
const AdminRegistrationsPage = lazy(() => import('./pages/admin/AdminRegistrationsPage'))
const AdminDrawPage      = lazy(() => import('./pages/admin/AdminDrawPage'))
const AdminFixturesPage  = lazy(() => import('./pages/admin/AdminFixturesPage'))
const AdminStandingsPage = lazy(() => import('./pages/admin/AdminStandingsPage'))
const AdminAuditPage     = lazy(() => import('./pages/admin/AdminAuditPage'))
const AdminSettingsPage  = lazy(() => import('./pages/admin/AdminSettingsPage'))

function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/"           element={<HomePage />} />
          <Route path="/register"   element={<RegisterPage />} />
          <Route path="/confirmation/:registrationId" element={<ConfirmationPage />} />
          <Route path="/dashboard"  element={<DashboardPage />} />
          <Route path="/team/:teamId" element={<TeamPage />} />
          <Route path="/fixtures"   element={<FixturesPage />} />
          <Route path="/standings"  element={<StandingsPage />} />
          <Route path="*"           element={<NotFoundPage />} />
        </Route>

        {/* Admin login (no layout chrome needed) */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Protected admin routes */}
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminLayout />
            </AdminGuard>
          }
        >
          <Route index                   element={<AdminDashboardPage />} />
          <Route path="students"         element={<AdminStudentsPage />} />
          <Route path="registrations"    element={<AdminRegistrationsPage />} />
          <Route path="draw"             element={<AdminDrawPage />} />
          <Route path="fixtures"         element={<AdminFixturesPage />} />
          <Route path="standings"        element={<AdminStandingsPage />} />
          <Route path="audit"            element={<AdminAuditPage />} />
          <Route path="settings"         element={<AdminSettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TournamentProvider>
          <AppRoutes />
        </TournamentProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

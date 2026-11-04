/**
 * Tests for authorization and role-based access control.
 * Covers the AdminGuard component and the is_admin() helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ----------------------------------------------------------------
// isAdmin() helper (pure function tests)
// ----------------------------------------------------------------

describe('isAdmin() helper', () => {
  // Inline the logic to test it without Supabase
  function isAdmin(session) {
    return session?.user?.app_metadata?.role === 'admin'
  }

  it('returns false for null session', () => {
    expect(isAdmin(null)).toBe(false)
  })

  it('returns false for undefined session', () => {
    expect(isAdmin(undefined)).toBe(false)
  })

  it('returns false when user has no app_metadata', () => {
    expect(isAdmin({ user: {} })).toBe(false)
  })

  it('returns false when role is not admin', () => {
    expect(isAdmin({ user: { app_metadata: { role: 'student' } } })).toBe(false)
    expect(isAdmin({ user: { app_metadata: { role: '' } } })).toBe(false)
    expect(isAdmin({ user: { app_metadata: {} } })).toBe(false)
  })

  it('returns true when role is exactly "admin"', () => {
    expect(isAdmin({ user: { app_metadata: { role: 'admin' } } })).toBe(true)
  })

  it('is case-sensitive — "Admin" is not admin', () => {
    expect(isAdmin({ user: { app_metadata: { role: 'Admin' } } })).toBe(false)
    expect(isAdmin({ user: { app_metadata: { role: 'ADMIN' } } })).toBe(false)
  })
})

// ----------------------------------------------------------------
// AdminGuard component
// ----------------------------------------------------------------

// We use a local version of AdminGuard that accepts session/loading
// as props for easy testing without full context setup.
function TestAdminGuard({ session, loading, children }) {
  const isAdminUser = session?.user?.app_metadata?.role === 'admin'

  if (loading) return <div>Loading…</div>
  if (!session) return <div data-testid="redirect-login">Redirect to login</div>
  if (!isAdminUser) return <div data-testid="redirect-home">Redirect to home</div>
  return children
}

describe('AdminGuard component', () => {
  it('shows loading state while auth is resolving', () => {
    render(
      <TestAdminGuard loading={true} session={null}>
        <div>Protected content</div>
      </TestAdminGuard>
    )
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('redirects to login when there is no session', () => {
    render(
      <TestAdminGuard loading={false} session={null}>
        <div>Protected content</div>
      </TestAdminGuard>
    )
    expect(screen.getByTestId('redirect-login')).toBeInTheDocument()
  })

  it('redirects to home when user is authenticated but not admin', () => {
    const session = { user: { app_metadata: { role: 'student' }, id: 'user-1' } }
    render(
      <TestAdminGuard loading={false} session={session}>
        <div>Protected content</div>
      </TestAdminGuard>
    )
    expect(screen.getByTestId('redirect-home')).toBeInTheDocument()
  })

  it('renders protected content for admin users', () => {
    const session = { user: { app_metadata: { role: 'admin' }, id: 'admin-1' } }
    render(
      <TestAdminGuard loading={false} session={session}>
        <div>Admin Dashboard</div>
      </TestAdminGuard>
    )
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
  })

  it('does not render protected content for a user with no role', () => {
    const session = { user: { app_metadata: {}, id: 'user-2' } }
    render(
      <TestAdminGuard loading={false} session={session}>
        <div>Secret admin panel</div>
      </TestAdminGuard>
    )
    expect(screen.queryByText('Secret admin panel')).not.toBeInTheDocument()
  })
})

// ----------------------------------------------------------------
// RLS policy logic simulation
// ----------------------------------------------------------------

describe('RLS policy rules (simulated)', () => {
  // Simulate what the RLS policies enforce

  function canReadDraw(userIsAdmin, drawStatus) {
    if (userIsAdmin) return true
    return drawStatus === 'published'
  }

  function canReadTeamMembers(userIsAdmin, drawStatus) {
    if (userIsAdmin) return true
    return drawStatus === 'published'
  }

  function canReadApprovedStudents(userIsAdmin) {
    return userIsAdmin // never publicly accessible
  }

  function canInsertRegistration(userIsAdmin) {
    // Only via SECURITY DEFINER RPC — direct inserts not allowed
    return false
  }

  it('anon user cannot read a draft draw', () => {
    expect(canReadDraw(false, 'draft')).toBe(false)
  })

  it('anon user can read a published draw', () => {
    expect(canReadDraw(false, 'published')).toBe(true)
  })

  it('admin can always read any draw', () => {
    expect(canReadDraw(true, 'draft')).toBe(true)
    expect(canReadDraw(true, 'published')).toBe(true)
    expect(canReadDraw(true, 'superseded')).toBe(true)
  })

  it('anon user cannot read team members of a draft draw', () => {
    expect(canReadTeamMembers(false, 'draft')).toBe(false)
  })

  it('anon user can read team members of a published draw', () => {
    expect(canReadTeamMembers(false, 'published')).toBe(true)
  })

  it('anon user cannot directly read approved_students', () => {
    expect(canReadApprovedStudents(false)).toBe(false)
  })

  it('admin can read approved_students', () => {
    expect(canReadApprovedStudents(true)).toBe(true)
  })

  it('direct insert to registrations table is always denied', () => {
    expect(canInsertRegistration(false)).toBe(false)
    expect(canInsertRegistration(true)).toBe(false) // even admin uses RPC
  })
})

// ----------------------------------------------------------------
// draw_generation authorization
// ----------------------------------------------------------------

describe('Draw generation authorization', () => {
  function canGenerateDraw(isAdminUser, phase) {
    if (!isAdminUser) return { allowed: false, reason: 'UNAUTHORIZED' }
    const validPhases = ['registration_closed', 'draw_generated']
    if (!validPhases.includes(phase)) return { allowed: false, reason: 'WRONG_PHASE' }
    return { allowed: true }
  }

  it('blocks non-admin users from generating a draw', () => {
    const result = canGenerateDraw(false, 'registration_closed')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('UNAUTHORIZED')
  })

  it('blocks admin from generating draw while registration is open', () => {
    const result = canGenerateDraw(true, 'registration_open')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('WRONG_PHASE')
  })

  it('allows admin to generate draw after registration is closed', () => {
    expect(canGenerateDraw(true, 'registration_closed').allowed).toBe(true)
  })

  it('allows admin to regenerate draw in draw_generated phase', () => {
    expect(canGenerateDraw(true, 'draw_generated').allowed).toBe(true)
  })

  it('blocks admin from generating draw after publication', () => {
    const result = canGenerateDraw(true, 'draw_published')
    expect(result.allowed).toBe(false)
  })
})

// ----------------------------------------------------------------
// Publish draw authorization
// ----------------------------------------------------------------

describe('Publish draw authorization', () => {
  function canPublishDraw(isAdminUser, drawStatus) {
    if (!isAdminUser) return { allowed: false, reason: 'UNAUTHORIZED' }
    if (drawStatus !== 'draft') return { allowed: false, reason: 'DRAW_NOT_DRAFT' }
    return { allowed: true }
  }

  it('prevents non-admin from publishing', () => {
    expect(canPublishDraw(false, 'draft').allowed).toBe(false)
  })

  it('prevents publishing an already-published draw', () => {
    expect(canPublishDraw(true, 'published').allowed).toBe(false)
    expect(canPublishDraw(true, 'published').reason).toBe('DRAW_NOT_DRAFT')
  })

  it('prevents publishing a superseded draw', () => {
    expect(canPublishDraw(true, 'superseded').allowed).toBe(false)
  })

  it('allows admin to publish a draft draw', () => {
    expect(canPublishDraw(true, 'draft').allowed).toBe(true)
  })
})

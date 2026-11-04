import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock the API client so tests never hit the network
vi.mock('../lib/api', () => ({
  signIn:                 vi.fn(),
  signOut:                vi.fn(),
  getSession:             vi.fn().mockResolvedValue(null),
  isAdmin:                vi.fn(s => !!s?.admin),
  getTournamentSettings:  vi.fn().mockResolvedValue({ phase: 'registration_open', squad_size: 5, substitute_slots: 2 }),
  getRegistrationSummary: vi.fn().mockResolvedValue([]),
  getRegistrations:       vi.fn().mockResolvedValue([]),
  registerStudent:        vi.fn(),
  getMyTeam:              vi.fn(),
  getApprovedStudents:    vi.fn().mockResolvedValue([]),
  upsertApprovedStudents: vi.fn(),
  setRegistrationPhase:   vi.fn(),
  updateAnnouncement:     vi.fn(),
  updateSettings:         vi.fn(),
  generateDraw:           vi.fn(),
  publishDraw:            vi.fn(),
  getDraws:               vi.fn().mockResolvedValue([]),
  getDrawTeams:           vi.fn().mockResolvedValue([]),
  getFixtures:            vi.fn().mockResolvedValue([]),
  upsertFixture:          vi.fn(),
  updateScore:            vi.fn(),
  getStandings:           vi.fn().mockResolvedValue([]),
  getAuditLog:            vi.fn().mockResolvedValue([]),
  getTeam:                vi.fn(),
  poll:                   vi.fn((fn) => { fn(); return () => {} }),
}))

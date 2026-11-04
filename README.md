# NICESA Inter-Level 5-a-Side Football Tournament

Official website for the NICESA (Nigerian Institution of Civil Engineering Students Association) inter-level football competition between Civil Engineering students from 100–500 Level.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS |
| Auth | Supabase Auth (email/password, admin-only) |
| Database | Supabase (PostgreSQL 15) |
| Server logic | PostgreSQL functions (SECURITY DEFINER) + Edge Functions (Deno) |
| Routing | React Router v6 |
| Icons | Lucide React |

## Project Structure

```
nicesa-tournament/
├── src/
│   ├── components/
│   │   ├── guards/      AdminGuard
│   │   ├── layout/      Navbar, Footer, PublicLayout, AdminLayout
│   │   └── ui/          Alert, Badge, EmptyState, Modal, Spinner
│   ├── context/         AuthContext, TournamentContext
│   ├── hooks/           useAsync, useRegistrationSummary
│   ├── lib/             supabase.js  (all API helpers)
│   ├── pages/
│   │   ├── admin/       Login, Dashboard, Students, Registrations,
│   │   │                Draw, Fixtures, Standings, Audit, Settings
│   │   └── public/      Home, Register, Confirmation, Dashboard,
│   │                    Team, Fixtures, Standings, 404
│   └── test/            drawAlgorithm, registration, authorization,
│                        standings
├── supabase/
│   ├── migrations/      001_initial_schema.sql, 002_draw_functions.sql
│   ├── functions/       generate-draw/, register-student/
│   └── seed/            seed.sql, sample_students.csv
├── .env.example
└── DEPLOYMENT.md
```

## Quick Start

```bash
# Install
npm install

# Configure environment (copy and fill in Supabase credentials)
cp .env.example .env.local

# Apply database migrations (local Supabase or remote)
supabase db reset

# Start development server
npm run dev

# Run tests
npm test
```

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full setup, admin user creation,
Edge Function deployment, and production hosting instructions.

## Key Features

### Student-facing
- Public homepage with live registration counts per level
- Registration via matric number with server-side verification
- Duplicate registration prevention
- Team dashboard (visible only after draw is published)
- Team roster page with level badges
- Live fixtures and standings

### Admin-facing
- Secure login with JWT role check (`app_metadata.role = "admin"`)
- CSV upload of approved student list with validation
- Registration management with search, filter, and CSV export
- One-click registration open/close toggle
- Team draw: configure squad size, generate, preview, save draft, publish
- Level-diversity algorithm (maximises cross-level squads)
- Unassigned player reporting (no one silently dropped)
- Fixture creation and inline score entry
- Auto-recalculated standings (DB trigger)
- Full audit log of every administrative action
- Tournament settings and announcement management

## Security Highlights

- `approved_students` table has zero public RLS access — verification is
  done entirely inside a `SECURITY DEFINER` RPC
- Unpublished draws are invisible to non-admin users (RLS)
- IP-based rate limiting on registration attempts (10 per hour)
- All admin actions require `is_admin()` check in both frontend and DB layer
- Client-supplied levels are never trusted — the server always looks up the
  student's level from the approved list

# NICESA Tournament — Deployment Guide (Turso + Hono)

## Architecture

```
Browser (React/Vite)  →  Hono API Server (Node.js)  →  Turso (libSQL)
```

The Hono server handles all authentication, secure RPCs, and the draw
algorithm. The frontend only talks to the Hono API — never directly to Turso.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Turso CLI | latest — `npm install -g @turso/cli` or `brew install tursodatabase/tap/turso` |

---

## 1 — Turso Setup

### 1.1 Sign up and create a database

```bash
turso auth signup       # or: turso auth login
turso db create nicesa-tournament
```

### 1.2 Get your credentials

```bash
# Database URL
turso db show nicesa-tournament --url
# → libsql://nicesa-tournament-<org>.turso.io

# Create an auth token
turso db tokens create nicesa-tournament
# → eyJ...  (copy this)
```

---

## 2 — Project Setup

### 2.1 Clone and install

```bash
git clone <your-repo-url>
cd nicesa-tournament
npm install
```

### 2.2 Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
TURSO_DATABASE_URL=libsql://nicesa-tournament-<org>.turso.io
TURSO_AUTH_TOKEN=<your-token-from-step-1.2>
JWT_SECRET=<long-random-string-min-48-chars>
API_PORT=3001
VITE_API_URL=http://localhost:3001
```

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2.3 Run migrations

```bash
npm run db:migrate
```

### 2.4 Seed development data

```bash
npm run db:seed
```

This creates:
- 26 approved students (5 per level + 1 ineligible test case)
- All eligible students auto-registered
- Admin user: `admin@nicesa.edu` / `Admin@2026!`

---

## 3 — Development

```bash
npm run dev
```

This starts both servers concurrently:
- **Vite** on http://localhost:5173 (proxies `/api` to `:3001`)
- **Hono API** on http://localhost:3001

---

## 4 — Production Deployment

### 4.1 Frontend — Vercel / Netlify

```bash
npm run build   # output in dist/
```

**Vercel:**
```bash
npx vercel --prod
```
Set env vars in Vercel dashboard:
- `VITE_API_URL` → your API server URL (e.g. `https://api.nicesa.yourdomain.com`)

**Netlify:** Upload `dist/`, add `public/_redirects`:
```
/*  /index.html  200
```

### 4.2 API Server — Railway / Render / Fly.io

The Hono server is a plain Node.js app. Deploy with:

**Railway:**
```bash
railway login
railway init
railway up
```
Set environment variables in Railway dashboard (same as `.env.local` minus `VITE_*`).

**Render:** Connect repo, set build command to `npm install`, start command to `node server/index.js`.

**Fly.io:**
```bash
fly launch
fly secrets set TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... JWT_SECRET=...
fly deploy
```

### 4.3 Production environment variables (API server)

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
JWT_SECRET=...          # same as used to sign any existing tokens
API_PORT=3001
FRONTEND_URL=https://nicesa.yourdomain.com   # for CORS
```

---

## 5 — Admin User Management

The seed script creates a default admin. For production, create admins via:

```bash
# Connect to your DB via Turso CLI
turso db shell nicesa-tournament

# Insert admin (replace hash with bcrypt of your password)
-- Use the seed script pattern or a small Node script:
```

```js
// create-admin.js  (run once)
import bcrypt from 'bcryptjs'
import { createClient } from '@libsql/client'

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const hash = await bcrypt.hash('YourStrongPassword!', 12)
await db.execute({
  sql:  `INSERT INTO admin_users (id, email, password_hash) VALUES (?, ?, ?)`,
  args: ['admin-id-1', 'admin@youruniversity.edu', hash],
})
console.log('Admin created.')
process.exit(0)
```

```bash
node create-admin.js
```

---

## 6 — Running Tests

```bash
npm test          # single run
npm run test:watch  # watch mode
```

---

## 7 — Post-Deployment Checklist

- [ ] `npm run db:migrate` applied to production Turso DB
- [ ] Admin user created in production DB
- [ ] Can log in at `/admin/login`
- [ ] Upload approved student CSV via Admin → Students
- [ ] Open registration in Admin → Settings
- [ ] Test a registration with a valid matric number
- [ ] Close registration → generate draw → publish
- [ ] Create fixtures → enter a test score → verify standings update

---

## 8 — Database Schema Summary

```
tournament_settings   — single config row (phase, squad size, announcement)
admin_users           — bcrypt-hashed admin credentials
approved_students     — admin-uploaded list; never exposed to public API
registrations         — created only via POST /register
draws                 — draft → published → superseded
teams                 — belong to a draw
team_members          — link registrations to teams
unassigned_players    — players who couldn't fit a complete team
fixtures              — match schedule with scores
standings             — recomputed after every score update
audit_log             — append-only admin action history
verification_attempts — IP-based rate limiting for registration
```

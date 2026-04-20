# StudySync MVP

StudySync is a full-stack accountability tracker for study and job prep with partner-first UX and team-ready architecture.

## Stack Decision

Backend uses **Node.js + Express + PostgreSQL + Prisma + Socket.IO + node-cron**.

Reason: this stack provides faster MVP iteration for realtime updates and scheduled nudges while staying production-friendly and maintainable.

## Features Implemented

- Workspace-aware user model (partner mode now, team mode ready)
- Seeded workspace with users `Pranav` and `Partner`
- JWT auth (`signup`, `login`, `me`)
- Google Sign-In with safe account linking by email
- Daily goals CRUD with date-safe records
- Daily progress APIs with completion math and remaining counts
- Quick updates (`+1` style) for DSA, job apps, and system design
- Persisted Settings page preferences:
  - profile + timezone
  - auth method visibility
  - self/partner notification controls
  - quiet hours and custom reminder times
  - realtime partner update toggle
- Notification engine for:
  - self progress alerts
  - partner progress alerts
  - completion alerts
  - on-track and not-started reminders
- Scheduled reminder sweep every 5 minutes (`node-cron`) honoring each user's configured reminder times and quiet hours
- Realtime updates with Socket.IO:
  - workspace progress update events
  - per-user notification events
- Dashboard API for self + partner cards
- Analytics API with 7-day trend and streak summary
- React UI pages:
  - Login
  - Signup
  - Dashboard
  - Goals
  - Notifications
  - Analytics
  - Settings
- Backend and frontend test setup with passing tests

## Project Structure

- `backend/` Express + Prisma API
- `frontend/` React + Vite + Tailwind app

## Docker Setup (Recommended)

Run the full stack with one command:

```bash
docker compose up --build
```

Services started:

- PostgreSQL: `localhost:5432`
- Backend API: `localhost:4000`
- Frontend (nginx): `localhost:5173`

Stop the stack:

```bash
docker compose down
```

Stop and remove DB volume too:

```bash
docker compose down -v
```

### Docker Verification Checklist

After startup, verify:

```bash
curl http://localhost:4000/api/health
curl -I http://localhost:5173
curl http://localhost:5173/api/health
```

Inspect logs if needed:

```bash
docker compose logs -f postgres backend frontend
```

The frontend uses nginx proxy routes:

- `/api/*` -> backend service
- `/socket.io/*` -> backend Socket.IO service

So dashboard and notifications realtime features work without changing browser hostnames.

## Prerequisites

- Node.js 20+
- PostgreSQL running locally
- Database user/password matching backend `.env`

## Local Setup

1. Create database:

```bash
createdb studysync
```

2. Backend setup:

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run dev
```

Optional for Google Sign-In (backend `.env`):

```env
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id
```

3. Frontend setup:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0 --port 5173
```

Optional for Google Sign-In (frontend `.env`):

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id
```

4. Open app:

- `http://localhost:5173`

## Seeded Credentials

Set these in your `.env` before running `prisma db seed`:

```
SEED_USER1_EMAIL=you@example.com
SEED_USER1_PASSWORD=yourpassword
SEED_USER2_EMAIL=partner@example.com
SEED_USER2_PASSWORD=partnerpassword
SEED_WORKSPACE_SLUG=my-accountability-circle
SEED_WORKSPACE_NAME=My Accountability Circle
```

Defaults when env vars are not set: `user1@example.com` / `changeme1`, `user2@example.com` / `changeme2`.

## Scripts

### Backend

- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run prisma:migrate -- --name <name>`
- `npm run prisma:seed`

### Frontend

- `npm run dev`
- `npm run build`
- `npm run test`

## Production-Readiness Notes

- Added Dockerfiles for backend and frontend.
- Added `docker-compose.yml` with PostgreSQL health checks and service dependencies.
- Backend container runs `prisma migrate deploy` and seed before startup.
- Frontend now uses route-level lazy loading/code splitting.
- Vite dev proxy handles `/api` and `/socket.io` during local non-docker development.

## Deployment: Vercel + Railway

Target stack:

- Frontend: Vercel
- Backend: Railway
- Database: Railway Postgres

### 1) Create Railway Postgres

1. In Railway, create a new project and add a PostgreSQL service.
2. Copy the generated connection string for `DATABASE_URL`.

### 2) Deploy Backend to Railway

1. Create a Railway service from the `backend` folder.
2. Configure these environment variables:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
JWT_SECRET=<strong-random-secret-at-least-16-chars>
CLIENT_URL=https://your-frontend.vercel.app
ALLOWED_ORIGINS=https://your-frontend.vercel.app
PUBLIC_BASE_URL=https://your-backend.up.railway.app
UPLOADS_DIR=./uploads
GOOGLE_CLIENT_ID=
```

3. Build command:

```bash
npm ci && npm run build
```

4. Start command:

```bash
npm run prisma:migrate:deploy && npm run start
```

5. Optional one-time seed (only if you want baseline demo data):

```bash
npm run prisma:seed
```

6. Verify:

```bash
curl https://your-backend.up.railway.app/api/health
```

### 3) Deploy Frontend to Vercel

1. Import the repository and set root directory to `frontend`.
2. Configure these environment variables in Vercel:

```env
VITE_API_URL=https://your-backend.up.railway.app/api
VITE_SOCKET_URL=https://your-backend.up.railway.app
VITE_GOOGLE_CLIENT_ID=
```

3. Deploy and verify login/dashboard/notifications.

### 4) Production Behavior Notes

- API and Socket.IO are environment-driven in frontend.
- Backend CORS accepts `CLIENT_URL` and optional comma-separated `ALLOWED_ORIGINS`.
- Prisma uses `DATABASE_URL` for Railway Postgres.
- Avatar uploads are served from backend `/uploads/*` and generated using `PUBLIC_BASE_URL`.
- Railway disk is ephemeral; uploaded avatars can be lost on redeploy/restart unless moved to persistent object storage later.

## API Highlights

- Auth
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/google`
  - `GET /api/auth/me`
- Settings
  - `GET /api/settings`
  - `PATCH /api/settings`
  - `POST /api/settings/avatar`
- Goals
  - `POST /api/goals`
  - `GET /api/goals?date=YYYY-MM-DD&userId=<optional>`
  - `PATCH /api/goals`
- Progress
  - `POST /api/progress`
  - `GET /api/progress?date=YYYY-MM-DD&userId=<optional>`
  - `POST /api/progress/quick-update`
- Dashboard
  - `GET /api/dashboard?date=YYYY-MM-DD`
- Notifications
  - `GET /api/notifications`
  - `PATCH /api/notifications/:id/read`
  - `PATCH /api/notifications/read-all`
  - `POST /api/notifications/run-reminders`
- Analytics
  - `GET /api/analytics?days=7`

## Notes

- Team mode is schema-ready through `Workspace`, `Membership`, and workspace-scoped records.
- Current UI prioritizes partner mode while avoiding hardcoded two-user storage constraints.

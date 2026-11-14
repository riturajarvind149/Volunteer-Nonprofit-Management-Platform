# ServeHub — Volunteer & Nonprofit Management Platform

Volunteer registration, rosters, check-in and hour tracking for nonprofit teams.

- **Volunteers** browse opportunities, register or join a waitlist, check in on the day, log hours and download a certificate of verified hours.
- **Coordinators** run verified organizations, publish opportunities, manage rosters and attendance, review hours and export reports.
- **Administrators** verify organizations, manage users and review an audit log.

| Folder | What it is |
|---|---|
| [`backend/`](backend/README.md) | Node.js + Express + PostgreSQL REST API, migrations, background jobs, integration tests |
| [`frontend/`](frontend/README.md) | React + Vite single-page app |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Render (API + database) and Vercel (frontend) setup, environment variables, troubleshooting |

## Quick start (local)

```bash
# 1. Backend — needs PostgreSQL running locally
cd backend
cp .env.example .env      # set DATABASE_URL, JWT_SECRET and PORT
npm install
npm run dev               # applies migrations, then serves on PORT

# 2. Frontend — in a second terminal
cd frontend
npm install
echo VITE_API_URL=http://localhost:5000 > .env.local   # same PORT as backend/.env
npm run dev               # open http://localhost:5173
```

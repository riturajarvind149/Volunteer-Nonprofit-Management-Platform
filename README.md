# ServeHub — Volunteer & Nonprofit Management Platform

Volunteer registration, rosters, check-in and hour tracking for nonprofit teams.

- **Volunteers** sign up themselves, browse opportunities, register or join a waitlist, check in on the day, log hours and download a certificate of verified hours.
- **NGOs** register through their **NGO admin**, who manages the NGO profile and team. Once the ServeHub team verifies the NGO it can publish opportunities.
- **Coordinators** are invited by an NGO admin. They publish opportunities, manage rosters and attendance, review hours and export reports for that NGO.
- **Administrators** verify NGOs, manage users and review an audit log.

### How an NGO gets started

1. **Register your NGO** (`/register/ngo`): NGO details plus the NGO admin's account, confirmed with a 6-digit email code.
2. A platform administrator reviews and **approves** it (until then the NGO can prepare drafts).
3. The NGO admin opens **My organizations → Team** and **invites coordinators** by email. Invitees accept from the link
   (new people create their account there; existing coordinators sign in).
4. The NGO admin can remove coordinators, cancel invitations and hand over the NGO admin role.

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

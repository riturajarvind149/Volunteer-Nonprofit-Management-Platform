# Deployment guide

ServeHub runs as three pieces:

| Piece | Where | Notes |
|---|---|---|
| PostgreSQL database | Render PostgreSQL (Singapore) | Created once; migrations run automatically |
| Backend API (`backend/`) | Render Web Service (Singapore) | Node 20+, Express |
| Frontend (`frontend/`) | Vercel | Static Vite build — https://volunteer-nonprofit-frontend.vercel.app |

Keep the database and the backend in the **same region** (Singapore) for low latency.

---

## 1. Backend on Render

Create a **Web Service** from this repository:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Region | Singapore (same as the database) |

On every start the server applies pending database migrations (`src/db/migrations/`),
then starts the API and the background jobs (event completion, reminders, cleanup).

### Environment variables

Set these in the Render dashboard (see `backend/.env.example` for every option):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Internal connection string of the Render database |
| `JWT_SECRET` | A long random string (≥ 32 characters): `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | `https://volunteer-nonprofit-frontend.vercel.app` — no trailing slash; comma-separate several origins |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Your email provider (Resend, Brevo, SendGrid, Mailgun, SES…) |
| `REQUIRE_EMAIL_VERIFICATION` | `true` once SMTP works (otherwise users can’t receive the link) |
| `REQUIRE_ORG_APPROVAL` | `true` once an admin account exists |
| `APP_TIMEZONE` | `Asia/Kolkata` (default) |

Without SMTP the app still works, but emails are only written to the server log.

### First administrator

Admins approve organizations and manage users. Create the first one from the Render **Shell**:

```bash
ADMIN_EMAIL=you@yourdomain.org ADMIN_PASSWORD='Str0ngPassword' npm run create-admin
```

### Check it

Open `https://<your-service>.onrender.com/api/health` → `{"status":"ok"}`
and `/api/health/db` → `{"status":"ok","database":"connected"}`.

---

## 2. Frontend on Vercel

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment variable | `VITE_API_URL=https://<your-service>.onrender.com` |

`frontend/vercel.json` rewrites every path to `index.html` so deep links such as
`/opportunities/123` work. (`public/_redirects` does the same on Render/Netlify static hosting.)

`VITE_API_URL` is baked in at build time — **redeploy the frontend after changing it**.

---

## 3. Recommended rollout order

1. Deploy the backend with `REQUIRE_EMAIL_VERIFICATION=false` and `REQUIRE_ORG_APPROVAL=false`.
2. Deploy the frontend and confirm sign-in works.
3. Create the first admin (`npm run create-admin`).
4. Configure SMTP and send yourself a password-reset email to test it.
5. Turn on `REQUIRE_EMAIL_VERIFICATION=true` and `REQUIRE_ORG_APPROVAL=true`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Browser console shows **CORS** errors | `FRONTEND_URL` on the backend must exactly match the frontend origin (scheme + host, no trailing slash or path). Redeploy after changing it. |
| Frontend shows “Can’t reach the server” | `VITE_API_URL` points to the wrong host, or the Render service is asleep (free instances take ~30 s to wake). |
| Render build looks for `package.json` in the repo root | Root Directory must be `backend`. |
| Users never receive verification / reset emails | Check SMTP variables and the Render logs for `[email]` lines. |
| Server exits at start with “Invalid configuration” | A required variable is missing — the log line names it. |

---

## Local development

```bash
# backend
cd backend
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, PORT
npm install
npm run dev

# frontend (new terminal)
cd frontend
npm install
echo VITE_API_URL=http://localhost:5000 > .env.local   # use the PORT from backend/.env
npm run dev                 # http://localhost:5173
```

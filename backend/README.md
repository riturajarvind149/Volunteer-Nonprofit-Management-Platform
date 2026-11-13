# Volunteer & Nonprofit Management Platform - Backend

Backend API service built with Node.js, Express, and PostgreSQL.

---

## Local Database Setup

Follow these steps to set up and verify the PostgreSQL database locally:

### 1. Ensure PostgreSQL is Running
Ensure that the PostgreSQL service is active on your local machine:
- **Windows**: Verify via Services management console or PowerShell:
  ```powershell
  Get-Service -Name *postgres*
  ```
- **macOS / Linux**:
  ```bash
  sudo systemctl status postgresql # Linux
  brew services list               # macOS
  ```

### 2. Create the Project Database
Using `psql` or pgAdmin, create a dedicated database for the platform:
```sql
CREATE DATABASE volunteer_db;
```
Or via the terminal:
```bash
createdb -U <username> volunteer_db
```

### 3. Configure `DATABASE_URL`
Create a `.env` file in the `backend/` directory by copying `.env.example`:
```bash
cp .env.example .env
```
Populate `DATABASE_URL` with your local PostgreSQL credentials:
```env
PORT=5000
DATABASE_URL=postgresql://<username>:<password>@localhost:5432/volunteer_db
NODE_ENV=development
```
*(Replace `<username>` and `<password>` with your local PostgreSQL role credentials).*

### 4. Run database migrations
Versioned SQL migrations live in `src/db/migrations/` and are tracked in a
`schema_migrations` table. They also run automatically when the server starts
(set `SKIP_MIGRATIONS=true` to disable).
```bash
npm run migrate          # apply pending migrations
npm run migrate:status   # list applied / pending
```
To change the schema, add a new file such as `003_add_something.sql` — never edit an applied migration.

### 4b. Create the first admin
Admins approve organizations and can suspend users. Admin accounts cannot be created through the API:
```bash
ADMIN_EMAIL=admin@yourdomain.org ADMIN_PASSWORD='Str0ngPassword' npm run create-admin
```

### 5. Start the Backend
Install dependencies (if not already installed) and run the development server:
```bash
npm install
npm run dev
```

### 6. Verify `/api/health`
Check the API server health:
```bash
curl http://localhost:5000/api/health
```
Expected response:
```json
{
  "status": "ok",
  "service": "api"
}
```

### 7. Verify `/api/health/db`
Check the database connection health:
```bash
curl http://localhost:5000/api/health/db
```
Expected response when connected:
```json
{
  "status": "ok",
  "database": "connected"
}
```
If PostgreSQL is unreachable or `DATABASE_URL` is misconfigured, the endpoint returns a `503 Service Unavailable` response with an error message.

---

## Tests

Tests run against the database in `DATABASE_URL` and clean up the data they create.
```bash
npm test                 # all suites
npm test -- signup       # suites whose file name contains "signup"
npm run test:production  # email verification, org approval, waitlist, check-in, certificates...
```

---

## Configuration highlights

See `.env.example` for every option.

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | — | Required; ≥ 32 chars in production |
| `FRONTEND_URL` | — | Allowed CORS origins (comma-separated); first one is used in email links |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | — | Transactional email. Without SMTP, emails are logged |
| `REQUIRE_EMAIL_VERIFICATION` | `true` | Users must verify their email before logging in |
| `REQUIRE_ORG_APPROVAL` | `true` | Admin must approve an organization before it can publish |
| `APP_TIMEZONE` | `Asia/Kolkata` | Event times, reminders and check-in window |
| `REMINDER_LEAD_HOURS` | `24` | When reminder emails go out |

---

## Security & operations

- **Headers / limits:** Helmet security headers, 100 KB JSON body limit, gzip compression.
- **Rate limiting:** login (10 failed attempts / 15 min), register / forgot-password / resend (10 / hour), whole API (600 / 15 min).
- **Sessions:** JWTs carry a token version — password change/reset, "log out everywhere" and account suspension revoke existing sessions immediately.
- **Passwords:** bcrypt (cost 12), at least 8 characters with a letter and a number.
- **Logging:** structured JSON logs (pino) with an `X-Request-Id` per request; secrets are redacted.
- **Background jobs:** event auto-completion, 24 h reminders and token cleanup; reminder/cleanup jobs use PostgreSQL advisory locks so several instances can run safely.
- **Graceful shutdown:** stops jobs, drains HTTP connections and closes the DB pool on SIGTERM.

---

## API overview (new in production-readiness release)

| Method & path | Who | Description |
|---|---|---|
| `POST /api/auth/verify-email` `{token}` | public | Confirm email |
| `POST /api/auth/resend-verification` `{email}` | public | Resend verification link |
| `POST /api/auth/forgot-password` `{email}` | public | Send reset link (generic response) |
| `POST /api/auth/reset-password` `{token, password}` | public | Set a new password |
| `POST /api/auth/logout-all` | user | Revoke all sessions |
| `GET /api/users/me/export` | user | Download personal data (JSON) |
| `DELETE /api/users/me` `{password}` | user | Permanently delete account |
| `GET /api/opportunities?q=&category=&location=&from_date=&to_date=&skills=&available=true&upcoming=true&sort=&page=&limit=` | public | Search published opportunities |
| `GET /api/opportunities/:id/calendar.ics` | public | Add to calendar |
| `POST/DELETE /api/opportunities/:id/waitlist` | volunteer | Join / leave waitlist (auto-promoted when a spot opens) |
| `POST /api/opportunities/:id/check-in` `{code}` | volunteer | Self check-in with the event code |
| `GET /api/signups/my/waitlist` | volunteer | My waitlist positions |
| `PATCH /api/signups/:id/attendance` `{attendance_status}` | coordinator | Mark PRESENT / ABSENT |
| `POST /api/signups/:id/hours/self` `{hours, notes}` | volunteer | Log own hours for review |
| `GET /api/hours/my/certificate` | volunteer | PDF certificate of verified hours |
| `GET /api/organizations?q=&page=` | public | Directory of verified organizations |
| `GET /api/organizations/mine` | coordinator | Own organizations (any status) |
| `GET /api/organizations/:id/opportunities` | public | An organization's opportunities |
| `GET /api/admin/stats` | admin | Platform KPIs |
| `GET /api/admin/organizations?status=PENDING` | admin | Review queue |
| `PATCH /api/admin/organizations/:id/verification` `{status, note}` | admin | Approve / reject / suspend |
| `GET /api/admin/users?q=&role=` · `PATCH /api/admin/users/:id` `{is_active}` | admin | Manage users |
| `GET /api/admin/audit-logs` | admin | Admin action history |

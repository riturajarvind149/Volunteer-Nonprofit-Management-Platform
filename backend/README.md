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

Integration tests live in `tests/` (one file per feature area). They start the API in-process,
run against the database in `DATABASE_URL`, and remove the data they create.
**Use a development database — never production.**
```bash
npm test                  # all suites
npm test -- signup        # suites whose file name contains "signup"
npm test -- production    # email verification, org approval, CORS, waitlist, check-in, certificates...
npm run lint              # oxlint: unused code and common mistakes
npm run test:cleanup      # remove leftover @test.org accounts from older runs (refuses in production)
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
| `REQUIRE_VOLUNTEER_DETAILS` | `true` | Volunteers must complete identity details (phone, city, DOB, emergency contact) before registering; admins can verify or flag them |
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

## API overview

Roles: **volunteer**, **coordinator** (a member of one or more NGOs — owner or appointed coordinator),
**NGO admin** (the owner member of that NGO), **admin** (platform).

| Method & path | Who | Description |
|---|---|---|
| `POST /api/auth/register` `{full_name, email, password}` | public | Volunteer sign-up (coordinators are invited by NGOs) |
| `POST /api/auth/register-organization` `{full_name, email, phone, password, organization}` | public | NGO sign-up: NGO admin account + NGO (pending verification) |
| `POST /api/auth/verify-email` `{token}` or `{email, code}` | public | Confirm email with the link or the 6-digit code |
| `POST /api/auth/resend-verification` `{email}` | public | Send a new code + link |
| `POST /api/auth/forgot-password` `{email}` | public | Send a reset code + link |
| `POST /api/auth/reset-password` `{token, password}` or `{email, code, password}` | public | Set a new password |
| `POST /api/auth/logout-all` | user | Revoke all sessions |
| `GET /api/users/me/export` | user | Download personal data (JSON) |
| `DELETE /api/users/me` `{password}` | user | Permanently delete account (NGO admins hand over first) |
| `GET /api/opportunities?q=&category=&location=&from_date=&to_date=&skills=&available=true&upcoming=true&sort=&page=&limit=` | public | Search published opportunities |
| `GET /api/opportunities/:id/calendar.ics` | public | Add to calendar |
| `POST/DELETE /api/opportunities/:id/waitlist` | volunteer | Join / leave waitlist (auto-promoted when a spot opens) |
| `POST /api/opportunities/:id/check-in` `{code}` | volunteer | Self check-in with the event code |
| `GET /api/signups/my/waitlist` | volunteer | My waitlist positions |
| `PATCH /api/signups/:id/attendance` `{attendance_status}` | coordinator | Mark PRESENT / ABSENT |
| `POST /api/signups/:id/hours/self` `{hours, notes}` | volunteer | Log own hours for review |
| `GET /api/hours/my/certificate` | volunteer | PDF certificate of verified hours |
| `GET /api/organizations?q=&page=` | public | Directory of verified NGOs (`my_role` when signed in) |
| `POST /api/organizations` `{name, registration_type, city, …}` | coordinator | Register an NGO (one per account) |
| `GET /api/organizations/mine` | coordinator | NGOs I belong to, with `my_role` |
| `PATCH /api/organizations/:id` | NGO admin | Edit the NGO profile |
| `GET /api/organizations/:id/impact` | public | Volunteers, verified hours, events |
| `GET /api/organizations/:id/team` | member | Members (and, for the NGO admin, open invitations) |
| `POST /api/organizations/:id/invitations` `{email}` | NGO admin | Invite a coordinator by email |
| `DELETE /api/organizations/:id/invitations/:invitationId` | NGO admin | Cancel an invitation |
| `DELETE /api/organizations/:id/members/:userId` | NGO admin / self | Remove a coordinator, or leave the NGO |
| `POST /api/organizations/:id/transfer-ownership` `{user_id}` | NGO admin | Hand the NGO admin role to a coordinator |
| `POST /api/invitations/preview` `{token}` | public | What an invitation link is for |
| `POST /api/invitations/accept` `{token, full_name?, password?}` | public / invitee | Join: new account, or signed in as the invited account |
| `GET /api/notifications` · `PATCH /api/notifications/:id/read` · `PATCH /api/notifications/read-all` | user | In-app notifications |
| `GET /api/analytics/volunteer` · `GET /api/analytics/coordinator` | volunteer / coordinator | Impact and monthly trends |
| `GET /api/reports/volunteer-participation` · `volunteer-hours` · `opportunity-performance` | coordinator | Reports (date range) |
| `GET /api/admin/stats` | admin | Platform KPIs |
| `GET /api/admin/organizations?status=PENDING` | admin | NGO review queue (with registration details) |
| `PATCH /api/admin/organizations/:id/verification` `{status, note}` | admin | Approve / reject / suspend |
| `GET /api/admin/users?q=&role=` · `PATCH /api/admin/users/:id` `{is_active}` | admin | Manage users |
| `GET /api/admin/audit-logs` | admin | Admin action history |

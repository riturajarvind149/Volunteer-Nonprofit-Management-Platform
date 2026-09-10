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

### 4. Execute `schema.sql`
Apply the initial relational schema to create tables, constraints, and indexes:
```bash
psql -U <username> -d volunteer_db -f src/db/schema.sql
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

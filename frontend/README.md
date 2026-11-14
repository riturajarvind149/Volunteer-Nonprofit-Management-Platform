# ServeHub — Frontend

React 19 + Vite single-page app for the Volunteer & Nonprofit Management Platform.

## Run locally

```bash
npm install
echo VITE_API_URL=http://localhost:5000 > .env.local   # match PORT in backend/.env
npm run dev                                            # http://localhost:5173
```

The backend must be running (see `../backend/README.md`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Oxlint |
| `npm test` | Vitest + Testing Library (requires **Node 22+**) |

## Configuration

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL (with or without `/api`). Baked in at build time. |
| `VITE_CACHE_DIR` | Optional location of Vite’s dependency cache. Defaults to the OS temp folder so projects inside OneDrive/Dropbox don’t hit `EPERM` errors. |

## Structure

```
src/
  components/     shared UI (layout, icons, pagination, password input…)
  context/        AuthContext (session, expiry handling), OpportunityContext
  pages/          one folder per screen, each with its CSS and tests
  services/api.js every backend call, error handling and file downloads
  utils/          formatting, CSV export, password rules, skills parsing
  test/           test setup and helpers
```

Deployment: see [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

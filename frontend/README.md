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
  context/        contexts + hooks (useAuth, useOpportunities, useNotifications) and their providers
  hooks/          useAutoLoad (page data loading), useDebouncedValue
  pages/          one folder per screen, each with its CSS and tests
  services/api.js every backend call, error handling and file downloads
  utils/          formatting, CSV export, password rules, skills parsing
  test/           test setup and helpers
```

## Security headers

`vercel.json` sends a Content-Security-Policy and other security headers with every page.
The policy only lets the app call APIs on `https://*.onrender.com`. **If the backend moves to
another host, add it to `connect-src` in `vercel.json`**, or every API call will be blocked.
Scripts may only come from this site, so keep scripts out of `index.html` (the theme script lives
in `public/theme-init.js`).

Deployment: see [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

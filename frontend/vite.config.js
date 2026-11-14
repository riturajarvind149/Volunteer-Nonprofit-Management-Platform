import os from 'node:os'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Keep Vite's dependency cache in the OS temp folder instead of node_modules/.vite.
// Synced folders (OneDrive, Dropbox, iCloud) turn node_modules/.vite into placeholder
// files that Node can't delete, which makes `npm run dev` fail with EPERM on startup.
// VITE_CACHE_DIR overrides the location if needed.
const cacheDir = process.env.VITE_CACHE_DIR || path.join(os.tmpdir(), 'servehub-frontend-vite')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir,
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // Tests mock src/services/api.js, so no backend or database is needed.
    mockReset: true,
  },
})

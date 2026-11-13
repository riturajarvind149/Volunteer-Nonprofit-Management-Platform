# Render Deployment - CORS Configuration

## Production CORS Configuration for Render

### Backend URL
```
https://volunteer-nonprofit-management-platform.onrender.com
```

### Frontend URL (Vercel)
```
https://volunteer-nonprofit-frontend.vercel.app
```

---

## Required Environment Variables in Render

In your Render dashboard for the backend service, add the following environment variable:

### Variable Name: `FRONTEND_URL`
### Variable Value:
```
https://volunteer-nonprofit-frontend.vercel.app
```

**Important Notes:**
- The `FRONTEND_URL` environment variable must be set in the Render dashboard
- Multiple origins can be configured using comma-separated values: `https://domain1.com,https://domain2.com`
- In production (`NODE_ENV=production`), only explicitly configured origins are allowed
- Localhost origins are NOT auto-added in production mode for security

---

## How CORS Works in This Backend

### Development Mode (`NODE_ENV=development`)
- Reads `FRONTEND_URL` from environment
- Auto-adds localhost origins: `http://localhost:5173`, `http://localhost:4173`, `http://localhost:3000`
- Allows requests from configured production origins AND localhost

### Production Mode (`NODE_ENV=production`)
- Reads `FRONTEND_URL` from environment
- Only allows explicitly configured origins
- Does NOT auto-add localhost origins
- More secure by default

### Implementation (from `src/app.js`)
```javascript
const buildAllowedOrigins = () => {
  const raw = process.env.FRONTEND_URL || '';
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Always allow localhost in non-production for developer convenience
  if (process.env.NODE_ENV !== 'production') {
    ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'].forEach((o) => {
      if (!origins.includes(o)) origins.push(o);
    });
  }

  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = buildAllowedOrigins();
    // Allow requests with no origin (mobile apps, curl, same-origin server calls)
    if (!origin || allowed.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin '${origin}' is not allowed`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
```

---

## CORS Features

✅ **Credentials Support**: `credentials: true` allows cookies and authorization headers  
✅ **Preflight Handling**: OPTIONS requests are automatically handled by the `cors` package  
✅ **Multiple Origins**: Comma-separated list support for multiple frontends  
✅ **No-Origin Requests**: Allows requests without Origin header (mobile apps, server-to-server)  
✅ **Environment-Based**: Different behavior for development vs production  

---

## Testing CORS Configuration

### Run Local Tests
```bash
# Test all CORS scenarios
npm run test:cors

# Test production-mode behavior
npm run test:cors:production
```

### Test Against Render Deployment
```bash
# Set the deployed backend URL
TEST_BASE_URL=https://volunteer-nonprofit-management-platform.onrender.com npm run test:cors
```

---

## Troubleshooting CORS Issues

### Issue: "No 'Access-Control-Allow-Origin' header is present"

**Cause**: `FRONTEND_URL` environment variable not set in Render

**Solution**: 
1. Go to Render dashboard → Your backend service → Environment
2. Add variable: `FRONTEND_URL` = `https://volunteer-nonprofit-frontend.vercel.app`
3. Save and wait for automatic redeployment

---

### Issue: Localhost works but production frontend doesn't

**Cause**: `NODE_ENV` is not set to `production` in Render

**Solution**:
1. Verify `NODE_ENV=production` is set in Render environment variables
2. Verify `FRONTEND_URL` includes your production frontend URL
3. Redeploy the service

---

### Issue: Preflight OPTIONS requests fail

**Status**: This is handled automatically by the `cors` middleware

**Verification**: The middleware handles:
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`
- `Access-Control-Allow-Credentials`

---

## Security Best Practices

✅ **Explicit Origins**: Only configured origins are allowed  
✅ **Production Lockdown**: Localhost not auto-added in production  
✅ **Credentials**: Enabled for authentication with cookies/tokens  
✅ **Error Messages**: Clear CORS rejection messages in logs  

---

## Summary

The backend CORS configuration:
1. ✅ Supports production frontend origin (`https://volunteer-nonprofit-frontend.vercel.app`)
2. ✅ Supports development localhost origins in development mode
3. ✅ Handles OPTIONS preflight requests correctly
4. ✅ Allows credentials for authentication
5. ✅ Middleware runs before routes (correct order)
6. ✅ Rejects unauthorized origins with clear error messages

**Action Required**: Set `FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app` in Render dashboard environment variables.

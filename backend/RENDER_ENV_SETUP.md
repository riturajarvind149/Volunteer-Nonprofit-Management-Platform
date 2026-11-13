# Render Environment Variable Setup - Quick Guide

## 🎯 Fix CORS Error in 3 Steps

### Step 1: Go to Render Dashboard
Navigate to: https://dashboard.render.com

### Step 2: Select Your Backend Service
Find and click on: **volunteer-nonprofit-management-platform**

### Step 3: Add Environment Variable
1. Click on **"Environment"** in the left sidebar
2. Scroll to "Environment Variables" section
3. Click **"Add Environment Variable"** button
4. Fill in:
   - **Key**: `FRONTEND_URL`
   - **Value**: `https://volunteer-nonprofit-frontend.vercel.app`
5. Click **"Save Changes"**

Render will automatically redeploy your service with the new environment variable.

---

## ✅ Verification

After the deployment completes (usually 2-3 minutes):

1. **Open your frontend**: https://volunteer-nonprofit-frontend.vercel.app
2. **Try to log in** with test credentials
3. **Check browser console** - CORS error should be gone
4. **Check Network tab** - API responses should include:
   ```
   Access-Control-Allow-Origin: https://volunteer-nonprofit-frontend.vercel.app
   Access-Control-Allow-Credentials: true
   ```

---

## 📋 Current Environment Variables in Render

Your Render backend service should have these environment variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `PORT` | Auto-set by Render | Server port |
| `DATABASE_URL` | Your PostgreSQL URL | Database connection |
| `NODE_ENV` | `production` | Environment mode |
| `JWT_SECRET` | Your secret key | JWT token signing |
| **`FRONTEND_URL`** | `https://volunteer-nonprofit-frontend.vercel.app` | **CORS allowed origin** ⬅ ADD THIS |

---

## 🔧 Alternative: Multiple Frontends

If you have multiple frontend deployments (staging, production, preview), use comma-separated values:

```
FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app,https://staging-frontend.vercel.app
```

---

## 🚨 Common Mistakes to Avoid

❌ **Wrong**: Including `/api` in the URL
```
FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app/api  # WRONG
```

✅ **Correct**: Just the origin (protocol + domain)
```
FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app  # CORRECT
```

❌ **Wrong**: Adding trailing slash
```
FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app/  # WRONG
```

✅ **Correct**: No trailing slash
```
FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app  # CORRECT
```

❌ **Wrong**: Using localhost in production
```
FRONTEND_URL=http://localhost:5173  # WRONG (only for local dev)
```

✅ **Correct**: Using production URL
```
FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app  # CORRECT
```

---

## 📞 Need Help?

If CORS error persists after setting the environment variable:

1. Check Render logs: Dashboard → Your Service → Logs
2. Verify environment variable is visible in logs at startup
3. Try manual redeploy: Dashboard → Your Service → Manual Deploy → Deploy latest commit
4. Wait 2-3 minutes for deployment to complete
5. Hard refresh frontend (Ctrl+Shift+R or Cmd+Shift+R)
6. Clear browser cache if needed

---

## 🎉 That's It!

Once you set `FRONTEND_URL` in Render, the CORS error will be resolved and your frontend will be able to communicate with the backend successfully.

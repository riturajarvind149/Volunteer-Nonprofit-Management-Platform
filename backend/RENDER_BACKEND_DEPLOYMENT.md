# Render Backend Deployment - Step-by-Step Guide

## ✅ Step 1: Database Setup (COMPLETED)

Your PostgreSQL database is ready:
- **Status**: ✅ Available
- **Name**: `volunteer-nonprofit-db`
- **Version**: PostgreSQL 18
- **Region**: Singapore (Southeast Asia)
- **Tables Created**: users, organizations, opportunities, signups, volunteer_hours, notifications

---

## 🚀 Step 2: Deploy Backend Web Service

### Go to Render Dashboard

1. Navigate to: https://dashboard.render.com
2. Click **"New +"** button (top right)
3. Select **"Web Service"**

---

### Connect Repository

1. If prompted, connect your GitHub account
2. Find and select repository: **`Volunteer-Nonprofit-Management-Platform`**
3. Click **"Connect"**

---

### Basic Configuration

Fill in these settings:

| Setting | Value |
|---------|-------|
| **Name** | `volunteer-nonprofit-backend` |
| **Region** | **Singapore (Southeast Asia)** ⚠️ MUST match database region |
| **Branch** | `main` (or your default branch) |
| **Root Directory** | `backend` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

**Important Notes:**
- ⚠️ **Root Directory MUST be `backend`** - This tells Render to look in the backend folder
- ⚠️ **Region MUST be Singapore** - Same region as database for best performance
- ℹ️ We're NOT running `npm run db:init` in build command since we already initialized the database

---

### Instance Type

Select: **Free** (or choose a paid plan if you need more resources)

---

### Environment Variables

Click **"Add Environment Variable"** and add these **6 variables**:

#### 1. PORT (Optional)
```
Key: PORT
Value: 5001
```
_(Optional - Render auto-assigns if omitted)_

#### 2. NODE_ENV (Required)
```
Key: NODE_ENV
Value: production
```

#### 3. DATABASE_URL (Required)
```
Key: DATABASE_URL
Value: postgresql://volunteer_nonprofit_db_2yv2_user:1FQCHMySDxH3Db4aQGfyzzdyCRkj34SQ@dpg-dbc7cg6i0phs73aks2mg-a.singapore-postgres.render.com/volunteer_nonprofit_db_2yv2
```

⚠️ **IMPORTANT**: Copy from your Render database dashboard → **Internal Database URL**

#### 4. JWT_SECRET (Required)
```
Key: JWT_SECRET
Value: 81042cabbebd7b5c1dcf261c5202821369329a65616ec41dc137258f38f3b2bd
```

⚠️ **SECURITY**: This is a randomly generated secret. Keep it secure!

#### 5. FRONTEND_URL (Required - Fixes CORS)
```
Key: FRONTEND_URL
Value: https://volunteer-nonprofit-frontend.vercel.app
```

⚠️ **IMPORTANT**: No trailing slash! This fixes the CORS error.

#### 6. DATABASE_SSL (Optional but recommended)
```
Key: DATABASE_SSL
Value: true
```

This explicitly enables SSL for database connection.

---

### Advanced Settings (Optional)

**Auto-Deploy**: ✅ Enabled (recommended)
- Automatically redeploys when you push to GitHub

**Health Check Path**: `/api/health`
- Render will ping this endpoint to verify service is running

---

### Summary of Environment Variables

Copy-paste ready format:

```bash
PORT=5001
NODE_ENV=production
DATABASE_URL=postgresql://volunteer_nonprofit_db_2yv2_user:1FQCHMySDxH3Db4aQGfyzzdyCRkj34SQ@dpg-dbc7cg6i0phs73aks2mg-a.singapore-postgres.render.com/volunteer_nonprofit_db_2yv2
JWT_SECRET=81042cabbebd7b5c1dcf261c5202821369329a65616ec41dc137258f38f3b2bd
FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app
DATABASE_SSL=true
```

---

## 🎯 Step 3: Deploy

1. Review all settings
2. Click **"Create Web Service"** button at the bottom
3. Render will start deployment process

---

## ⏳ Step 4: Monitor Deployment

### Deployment Process (3-5 minutes)

Watch the logs. You should see:

```
==> Cloning from https://github.com/...
==> Checking out commit ...
==> Downloading cache...
==> Running build command 'npm install'...
    npm install
    added XXX packages
==> Build successful!
==> Starting service with 'npm start'...
    Server running on port XXXX
    [Scheduler] Opportunity completion scheduler started
==> Service is live!
```

### Success Indicators:

✅ Build completes without errors  
✅ Server starts and listens on port  
✅ Health check returns 200 OK  
✅ Status shows "Live" (green)

---

## ✅ Step 5: Verify Deployment

### Test Backend Health

1. Copy your backend URL from Render dashboard
   - Format: `https://volunteer-nonprofit-backend.onrender.com`
2. Visit: `https://your-backend-url.onrender.com/api/health`
3. Should return: `{"status":"ok"}` or similar

### Test CORS

1. Open: https://volunteer-nonprofit-frontend.vercel.app
2. Try to log in
3. Open browser DevTools → Console
4. ✅ CORS error should be GONE!
5. Check Network tab → Response headers should show:
   ```
   Access-Control-Allow-Origin: https://volunteer-nonprofit-frontend.vercel.app
   Access-Control-Allow-Credentials: true
   ```

---

## 🔧 Troubleshooting

### Issue: Build fails with "Cannot find module"
**Cause**: Root directory not set correctly  
**Solution**: Set Root Directory to `backend`

### Issue: "ECONNREFUSED" or database connection fails
**Cause**: DATABASE_URL incorrect or database not in same region  
**Solution**:
- Verify DATABASE_URL matches Internal Database URL from Render
- Verify both services are in Singapore region
- Add `DATABASE_SSL=true` environment variable

### Issue: "Server failed to start"
**Cause**: Missing environment variables  
**Solution**: Verify all 5-6 required environment variables are set

### Issue: CORS error persists
**Cause**: FRONTEND_URL not set or incorrect  
**Solution**: 
- Verify `FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app`
- No trailing slash
- No `/api` suffix
- Wait for deployment to complete after setting

### Issue: Health check fails
**Cause**: Server not starting or listening on wrong port  
**Solution**:
- Check logs for errors
- Verify START command is `npm start`
- Verify server listens on `process.env.PORT`

---

## 🔄 Redeployment

If you need to redeploy:

### Method 1: Automatic (Recommended)
- Push changes to GitHub
- Render automatically redeploys if Auto-Deploy is enabled

### Method 2: Manual
1. Go to Render dashboard → Your service
2. Click **"Manual Deploy"** button
3. Select **"Deploy latest commit"**

---

## 📊 Post-Deployment Checklist

- [ ] Backend service shows "Live" status (green)
- [ ] Health endpoint returns 200 OK
- [ ] Frontend can log in without CORS errors
- [ ] Database tables contain expected data
- [ ] All API endpoints respond correctly
- [ ] Logs show no errors

---

## 🎉 Deployment Summary

### Database
- ✅ Created and initialized
- ✅ Tables: users, organizations, opportunities, signups, volunteer_hours, notifications
- ✅ Region: Singapore

### Backend
- 🔄 Ready to deploy with configuration above
- 📝 Environment variables prepared
- 🔒 JWT secret generated
- 🌐 CORS configured for Vercel frontend

### Frontend (Already Deployed)
- ✅ URL: https://volunteer-nonprofit-frontend.vercel.app
- ✅ VITE_API_URL configured to point to backend

---

## 📞 Need Help?

If deployment fails:
1. Check Render logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure database is in "Available" state
4. Try manual redeploy
5. Check that Root Directory is set to `backend`

---

## 🔐 Security Notes

**⚠️ IMPORTANT**: Your JWT_SECRET and DATABASE_URL are sensitive credentials!

- ✅ Never commit these to Git
- ✅ Never share publicly
- ✅ Change JWT_SECRET if compromised
- ✅ Render encrypts environment variables at rest

---

## Next Steps

After successful backend deployment:

1. ✅ Test all API endpoints
2. ✅ Create test user accounts
3. ✅ Verify frontend → backend integration
4. ✅ Monitor logs for any errors
5. ✅ Set up custom domain (optional)

---

**Your backend is ready to deploy! Follow the steps above to create the web service in Render.**

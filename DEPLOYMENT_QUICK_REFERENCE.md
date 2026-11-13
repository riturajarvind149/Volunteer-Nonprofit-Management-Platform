# 🚀 Quick Deployment Reference

## Database ✅ COMPLETED

**Status**: Available and Initialized  
**Connection**: Internal URL configured  
**Tables**: 6 tables created successfully

---

## Backend Web Service - Configuration

### Basic Settings
```
Name: volunteer-nonprofit-backend
Region: Singapore (Southeast Asia)
Branch: main
Root Directory: backend
Environment: Node
Build Command: npm install
Start Command: npm start
Instance: Free
```

### Environment Variables (Copy-Paste Ready)
```
PORT=5001
NODE_ENV=production
DATABASE_URL=postgresql://volunteer_nonprofit_db_2yv2_user:1FQCHMySDxH3Db4aQGfyzzdyCRkj34SQ@dpg-dbc7cg6i0phs73aks2mg-a.singapore-postgres.render.com/volunteer_nonprofit_db_2yv2
JWT_SECRET=81042cabbebd7b5c1dcf261c5202821369329a65616ec41dc137258f38f3b2bd
FRONTEND_URL=https://volunteer-nonprofit-frontend.vercel.app
DATABASE_SSL=true
```

---

## Deployment Steps

1. **Go to**: https://dashboard.render.com
2. **Click**: New + → Web Service
3. **Select**: Volunteer-Nonprofit-Management-Platform repo
4. **Fill in**: Basic settings above
5. **Add**: All 6 environment variables
6. **Click**: Create Web Service
7. **Wait**: 3-5 minutes for deployment
8. **Test**: Visit https://your-backend-url.onrender.com/api/health

---

## Verification

### Backend Health Check
```
https://your-backend-url.onrender.com/api/health
Expected: {"status":"ok"}
```

### Frontend Integration
```
https://volunteer-nonprofit-frontend.vercel.app
Try: Login → Should work without CORS error
```

---

## ⚠️ Critical Settings

- ✅ Root Directory = `backend` (NOT empty!)
- ✅ Region = Singapore (match database!)
- ✅ FRONTEND_URL = No trailing slash!
- ✅ DATABASE_URL = Use Internal Database URL

---

## 📋 Deployment Checklist

Database Setup:
- [x] PostgreSQL database created
- [x] Database initialized with schema
- [x] Tables verified (6 tables)

Backend Deployment:
- [ ] Web service created in Render
- [ ] Basic settings configured
- [ ] Environment variables added (all 6)
- [ ] Deployment started
- [ ] Build completed successfully
- [ ] Server running (check logs)
- [ ] Health endpoint returning 200 OK

Integration Testing:
- [ ] Backend health check passes
- [ ] Frontend can reach backend
- [ ] CORS error resolved
- [ ] Login functionality works
- [ ] API calls succeed

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Check Root Directory = `backend` |
| Database connection fails | Verify DATABASE_URL and region match |
| CORS error | Verify FRONTEND_URL exactly matches |
| Server won't start | Check logs for missing env vars |
| 503 Service Unavailable | Wait for deployment to complete |

---

## 📞 Important Links

- **Render Dashboard**: https://dashboard.render.com
- **Frontend**: https://volunteer-nonprofit-frontend.vercel.app
- **Detailed Guide**: See `backend/RENDER_BACKEND_DEPLOYMENT.md`
- **CORS Configuration**: See `backend/CORS_FIX_SUMMARY.md`

---

**Ready to deploy!** Follow the steps above to create your backend web service.

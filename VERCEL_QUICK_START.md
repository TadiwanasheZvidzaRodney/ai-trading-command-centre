# 🚀 Vercel Deployment - Quick Start (5-10 minutes per service)

**Status:** Ready to Deploy Right Now  
**Complexity:** Easy (follow the checklist)  
**Time Estimate:** 30-40 minutes total  

---

## 📋 Before You Start

```bash
# 1. Verify local build works
npm run build
# Should complete with no errors

# 2. Verify all tests pass
npm test
# Should show 376 tests passing

# 3. Commit everything
git status
# Should be clean
```

---

## STEP 1️⃣  MongoDB Atlas (5-10 min)

### Go to: https://www.mongodb.com/cloud/atlas

```
1. "Try Free" → Sign up with email
2. Create Cluster → Free Tier Shared
3. Choose region (nearest to you)
4. Wait 2-3 minutes for cluster to be ready
5. Security → Database Access → Add User
   └─ Username: atc_user
   └─ Password: [CREATE STRONG PASSWORD & SAVE IT]
6. Security → Network Access → Add IP
   └─ For now: Allow From Anywhere (0.0.0.0/0)
7. Databases → Connect → Drivers (Node.js)
   └─ Copy connection string (you'll use this in Step 3)
   └─ Format: mongodb+srv://atc_user:PASSWORD@cluster...
```

**⏱️ Time: 5-10 min**

---

## STEP 2️⃣  Render Backend (10-15 min)

### Go to: https://render.com

```
1. Sign up with GitHub (authorize)
2. Dashboard → New → Web Service
3. Select your GitHub repo
4. Configure:
   ├─ Name: atc-api
   ├─ Environment: Node
   ├─ Build: npm install && npm run build -w @atc/api
   └─ Start: node apps/api/dist/index.js
5. Create Web Service (wait for build ~2 min)
6. Environment → Add Variables:
   ├─ MONGODB_URI = [paste from Step 1]
   ├─ MONGODB_DB = atc
   ├─ NODE_ENV = production
   ├─ WEB_URL = [you'll get from Step 3]
   ├─ AUTH_MODE = disabled
   ├─ TRADING_MODE = research
   ├─ AI_PROVIDER = disabled
   └─ LOG_LEVEL = info
7. Redeploy → Copy your service URL (something like: https://atc-api-xxxxx.onrender.com)
```

**⏱️ Time: 10-15 min**  
**Save:** Your Render URL for Step 3

---

## STEP 3️⃣  Vercel Frontend (10-15 min)

### Go to: https://vercel.com

```
1. Sign up with GitHub (authorize)
2. Dashboard → Add New → Project
3. Select your ai-trading-command-centre repo
4. Framework: Next.js (auto-detected)
5. Configure:
   ├─ Project Name: atc-web (or your choice)
   ├─ Root Directory: ./apps/web
   ├─ Build Command: npm run build -w @atc/web
   └─ Output: .next
6. Deploy (wait for build ~2 min)
7. Settings → Environment Variables:
   ├─ NEXT_PUBLIC_API_URL = [paste your Render URL from Step 2]
   └─ NODE_ENV = production
8. Deployments → Click latest → Redeploy (IMPORTANT!)
9. Copy your Vercel URL (something like: https://atc-web.vercel.app)
```

**⏱️ Time: 10-15 min**  
**Done:** Your site is now live! 🎉

---

## ✅ TESTING (2-3 min)

### Test Backend
```bash
curl https://atc-api-xxxxx.onrender.com/health
# Should return: {"status":"ok",...}
```

### Test Frontend
```
Open: https://atc-web.vercel.app
Should see dashboard with 7 pages:
├─ / (Dashboard)
├─ /markets (Live quotes - EUR/USD, GBP/USD, XAU/USD)
├─ /tasks
├─ /calendar
├─ /news
├─ /analysis (Technical indicators)
└─ /copilot (AI Copilot - Phase 6) ← COOL FEATURE!
```

### Test API Integration
```
1. Go to /markets → Should show live quotes
2. Go to /analysis → Should show chart + indicators
3. Go to /copilot → Click "Generate Analysis" → Should show AI report
```

---

## 🎯 URLs You'll Have After Deployment

```
Frontend:  https://atc-web.vercel.app
Backend:   https://atc-api-xxxxx.onrender.com
Database:  MongoDB Atlas (internal)
```

---

## ⚙️ Configuration Reference

### MongoDB Connection String Format
```
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/DATABASE?retryWrites=true&w=majority

Example (Don't use real):
mongodb+srv://atc_user:MyP@ssw0rd123@cluster0.abc123.mongodb.net/atc?retryWrites=true&w=majority
```

### Environment Variables (Render Backend)
```
MONGODB_URI             [from MongoDB Atlas]
MONGODB_DB              atc
NODE_ENV                production
WEB_URL                 https://atc-web.vercel.app
AUTH_MODE               disabled
TRADING_MODE            research
LIVE_TRADING_ENABLED    false
AI_PROVIDER             disabled
LOG_LEVEL               info
```

### Environment Variables (Vercel Frontend)
```
NEXT_PUBLIC_API_URL     https://atc-api-xxxxx.onrender.com
NODE_ENV                production
```

---

## ⚠️ Common Issues & Fixes

### "API not responding" or "503 error"
```
→ Render free tier auto-pauses after 15 min of inactivity
→ First request takes ~30 seconds to wake up
→ Wait 30 seconds and try again
→ Solution: Upgrade to paid tier, or don't worry for dev
```

### "Frontend can't connect to backend"
```
→ Check NEXT_PUBLIC_API_URL is set correctly
→ Redeploy Vercel frontend after setting env var
→ Check browser console (F12) for exact error
→ Test: https://your-backend-url.onrender.com/health
```

### "MongoDB connection fails"
```
→ Check MONGODB_URI is copied correctly (no spaces)
→ Verify MongoDB user/password is correct
→ Check Network Access whitelist includes your Render IP
→ Test connection string in MongoDB Atlas console
```

### "Cold start takes too long"
```
→ Normal on Render free tier (~30 seconds)
→ This is OK for development/testing
→ For production: upgrade to paid tier
```

---

## 🔐 Security Quick Notes

```
✅ All connections use HTTPS (Vercel/Render provide)
✅ MongoDB connection encrypted (MongoDB Atlas)
✅ Rate limiting enabled (120 req/min)
⚠️  Authentication disabled (for testing - enable in production)
⚠️  Allow From Anywhere on MongoDB (for testing - restrict in production)
```

---

## 📊 What You Get (Free Tier)

```
✅ Frontend:     Unlimited deployments, fast CDN, custom domains optional
✅ Backend:      Free tier with auto-pause (wake up on request)
✅ Database:     512 MB free storage, sufficient for testing
✅ Bandwidth:    Generous limits on all services
✅ Build Time:   Free build minutes included
```

---

## 🎊 That's It!

Your AI Trading Command Centre is now deployed and live! 🎉

**What you have:**
- Live dashboard at Vercel
- API running on Render
- Database in MongoDB Atlas
- All 7 pages working
- AI Copilot (Phase 6) ready to use
- 40+ API endpoints accessible

**Share with team:**
```
Frontend: https://atc-web.vercel.app
Docs: Check VERCEL_DEPLOYMENT_GUIDE.md for details
```

---

**Next Steps:**
1. Play around with the deployed version
2. Test the /copilot page (AI Analysis)
3. Monitor logs if anything breaks
4. Plan Phase 7 (Risk & Paper Trading)
5. When ready: upgrade to paid tiers for production

---

**Deployment Checklist Created:** October 30, 2026  
**Ready to Deploy:** YES ✅  
**Estimated Total Time:** 30-40 minutes  
**Total Cost:** $0/month (free tier)

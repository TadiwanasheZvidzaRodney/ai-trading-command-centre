# 🚀 Vercel Deployment Guide - AI Trading Command Centre

> Superseded for this repository's current Vercel + Render + MongoDB Atlas setup. This
> older guide includes unsafe or stale settings. Use [docs/operations/deployment.md](docs/operations/deployment.md)
> and the `npm run deploy` CLI instead.

**Date:** October 30, 2026  
**Deployment Type:** Frontend-only (Recommended)  
**Frontend:** Next.js on Vercel  
**Backend:** Render/Railway/Fly.io (separate)

---

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Next.js App (apps/web)                                │
│  ├─ /                    Dashboard                     │
│  ├─ /markets             Market data                   │
│  ├─ /tasks               Task management               │
│  ├─ /calendar            Economic calendar             │
│  ├─ /news                News feed                     │
│  ├─ /analysis            Technical analysis            │
│  └─ /copilot             AI Analysis (Phase 6)         │
│                                                         │
│  Static: 16 routes                                     │
│  Build Time: ~2-3 minutes                              │
│  Bundle Size: ~500 KB                                  │
│                                                         │
│  Environment Variables:                                │
│  ├─ NEXT_PUBLIC_API_URL  (set to backend URL)          │
│  └─ NODE_ENV=production                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
           ↕ HTTPS (same-origin or CORS)
┌─────────────────────────────────────────────────────────┐
│                Backend (Separate Service)               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Fastify API (apps/api)                                │
│  ├─ GET  /health         System health                 │
│  ├─ GET  /health/providers  Provider status            │
│  ├─ POST /api/v1/instruments   Instrument list         │
│  ├─ GET  /api/v1/market/*   Market data               │
│  ├─ POST /api/v1/technical/*   Technical analysis      │
│  ├─ GET  /api/v1/news        News feed                 │
│  ├─ GET  /api/v1/calendar    Economic calendar         │
│  └─ POST /api/v1/copilot/*   AI Analysis (Phase 6)    │
│                                                         │
│  Hosting Options:                                      │
│  ├─ Render.com (Recommended - free tier)              │
│  ├─ Railway.app (free tier)                           │
│  └─ Fly.io (free tier)                                │
│                                                         │
│  Environment:                                          │
│  ├─ MongoDB (MongoDB Atlas free tier)                 │
│  ├─ Gemini API Key (optional, for AI)                 │
│  └─ 40+ endpoints running                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
           ↕ Database Connection
┌─────────────────────────────────────────────────────────┐
│                   MongoDB Atlas                         │
├─────────────────────────────────────────────────────────┤
│  Free Tier: 512 MB storage                             │
│  Collections:                                          │
│  ├─ copilot_reports  (AI analysis history)            │
│  ├─ paper_trades     (trading journal)                 │
│  └─ user_preferences (settings, watchlists)           │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Step 1: Prepare Your Repository

### Current Status

```
✅ Next.js app ready              apps/web/
✅ Fastify API ready              apps/api/
✅ All tests passing             376/376
✅ TypeScript clean              0 errors
✅ Build succeeds                npm run build
✅ vercel.json created           (just added)
```

### Verify Build Works Locally

```bash
npm run build
# Output should show:
# - @atc/api built (285.4 KB)
# - @atc/web built (16 static routes)
# - Both builds successful
```

---

## ✅ Step 2: Set Up MongoDB Atlas (Free Tier)

### 1. Create Account

```
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free"
3. Sign up with email
4. Verify email
```

### 2. Create Cluster

```
1. Create cluster → Free Tier (Shared)
2. Choose region (closest to you)
3. Cloud Provider: AWS/Google/Azure (any)
4. Cluster name: "atc-production"
5. Create cluster (takes 2-3 minutes)
```

### 3. Create Database User

```
1. Security → Database Access
2. Add Database User
   - Username: atc_user
   - Password: (generate or create strong one)
   - Built-in Role: Read and write to any database
3. Save

Store credentials safely! You'll need them in Step 4.
```

### 4. Whitelist IP (or allow all for development)

```
1. Security → Network Access
2. Add IP Address
   - Option A: Add current IP
   - Option B: Allow From Anywhere (0.0.0.0/0) for development
3. Confirm

⚠️ NOTE: For production, always restrict to known IPs.
```

### 5. Get Connection String

```
1. Databases → Connect
2. Choose: Drivers
3. Select: Node.js, Latest version
4. Copy connection string

Format:
mongodb+srv://atc_user:PASSWORD@cluster.mongodb.net/atc?retryWrites=true&w=majority

Replace PASSWORD with the one you created in Step 3.
```

---

## ✅ Step 3: Deploy Backend to Render (Free Tier)

### 1. Create Render Account

```
1. Go to https://render.com
2. Sign up with GitHub
3. Connect your repository
```

### 2. Create New Web Service

```
1. Dashboard → New → Web Service
2. Select your GitHub repository
3. Configure:
   - Name:            atc-api
   - Environment:     Node
   - Region:          (closest to you)
   - Branch:          main
   - Build Command:   npm install && npm run build -w @atc/api
   - Start Command:   node apps/api/dist/index.js
   - Plan:            Free (or paid if you want)
4. Create Web Service
```

### 3. Add Environment Variables

```
In Render Dashboard → atc-api → Environment:

Required (must set):
────────────────────────────────
MONGODB_URI         mongodb+srv://atc_user:PASSWORD@cluster.mongodb.net/atc?retryWrites=true&w=majority
MONGODB_DB          atc
NODE_ENV            production
API_PORT            3000  (Render assigns dynamically, but set for local runs)
WEB_URL             https://your-vercel-url.vercel.app

Optional (leave as is for now):
────────────────────────────────
AUTH_MODE           disabled
TRADING_MODE        research
LIVE_TRADING_ENABLED false
AI_PROVIDER         disabled
LOG_LEVEL           info

Details on each below.
```

### 4. Get Backend URL

```
After deployment, you'll see:
  https://atc-api-xxxxx.onrender.com

This is your backend URL. Save it for Step 5.
```

---

## ✅ Step 4: Deploy Frontend to Vercel

### 1. Create Vercel Account (Free)

```
1. Go to https://vercel.com
2. Sign up with GitHub
3. Authorize Vercel to access your repositories
```

### 2. Import Project

```
1. Dashboard → Add New → Project
2. Select: ai-trading-command-centre repository
3. Framework Preset: Next.js
4. Configure:
   - Project Name:        atc-web (or your choice)
   - Root Directory:      ./apps/web
   - Build Command:       npm run build -w @atc/web
   - Output Directory:    .next
5. Click Deploy
```

### 3. Add Environment Variables

```
In Vercel Dashboard → Settings → Environment Variables:

Add:
────────────────────────────────
NEXT_PUBLIC_API_URL    https://atc-api-xxxxx.onrender.com
NODE_ENV               production

Note: NEXT_PUBLIC_API_URL will be embedded in client-side code.
It MUST be set before deployment, or frontend won't know where backend is.
```

### 4. Trigger Redeploy (Important!)

```
After setting NEXT_PUBLIC_API_URL:
1. Go to Deployments
2. Click on latest deployment
3. Click "Redeploy"
4. Confirm

This rebuilds with the correct API URL embedded.
```

### 5. Get Frontend URL

```
After deployment, you'll see:
  https://atc-web.vercel.app  (or custom domain)

This is your frontend URL. Users go here.
```

---

## 🔧 Environment Variables Summary

### Frontend (Vercel)

```
NEXT_PUBLIC_API_URL=https://atc-api-xxxxx.onrender.com
NODE_ENV=production
```

### Backend (Render)

```
# Database
MONGODB_URI=mongodb+srv://atc_user:PASSWORD@cluster.mongodb.net/atc?retryWrites=true&w=majority
MONGODB_DB=atc

# Runtime
NODE_ENV=production
API_PORT=3000
WEB_URL=https://atc-web.vercel.app

# Auth (start with disabled)
AUTH_MODE=disabled
AUTH_USERNAME=
AUTH_PASSWORD_HASH=
SESSION_SECRET=dev-only-change-this-session-secret-32chars

# Trading Safety (research mode only for now)
TRADING_MODE=research
LIVE_TRADING_ENABLED=false

# Market Data (using free providers)
MARKET_DATA_QUOTE_PROVIDER=swissquote
MARKET_DATA_CANDLE_PROVIDER=yahoo
MARKET_DATA_CACHE_QUOTE_SECONDS=15
MARKET_DATA_CACHE_CANDLE_SECONDS=300

# News (RSS, no key)
NEWS_PROVIDER=rss
NEWS_RSS_FEEDS=https://www.fxstreet.com/rss/news,https://feeds.content.dowjones.io/public/rss/mw_topstories
NEWS_POLL_MINUTES=15

# Calendar (community feed, no key)
CALENDAR_PROVIDER=forexfactory
CALENDAR_POLL_MINUTES=60

# AI Analysis (start with disabled, upgrade later)
AI_PROVIDER=disabled
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
AI_TIMEOUT_MS=60000

# Rate Limiting
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW=1 minute

# Logging
LOG_LEVEL=info
```

---

## 🧪 Testing Deployment

### 1. Check Frontend

```
1. Open: https://atc-web.vercel.app
2. Should see dashboard load
3. Navigate to each page:
   - / (Dashboard)
   - /markets
   - /tasks
   - /calendar
   - /news
   - /analysis
   - /copilot (AI Copilot - Phase 6)
4. Check browser console (F12) for errors
```

### 2. Check Backend

```bash
# Test health endpoint
curl https://atc-api-xxxxx.onrender.com/health
# Expected response: {"status":"ok","timestamp":"..."}

# Test providers status
curl https://atc-api-xxxxx.onrender.com/health/providers
# Expected response: provider status JSON

# Test API
curl -X POST https://atc-api-xxxxx.onrender.com/api/v1/copilot/analyze \
  -H "Content-Type: application/json" \
  -d '{"instrument":"EUR/USD","timeframe":"4h","lookback":200}'
# Expected response: AI analysis report (with fallback data)
```

### 3. Check API Integration

```
1. Open dashboard: https://atc-web.vercel.app
2. Go to /markets
3. Should see live quote data (EUR/USD, GBP/USD, XAU/USD)
4. Go to /analysis
5. Should see technical indicators
6. Go to /copilot
7. Click "Generate Analysis"
8. Should generate report (with or without AI, depending on AI_PROVIDER)
```

---

## 📊 Free Tier Limits

### Vercel Frontend

```
✅ Bandwidth:        100 GB/month (enough for most users)
✅ Deployments:      Unlimited
✅ Build Time:       ~2-3 minutes
✅ Build Minutes:    45/month (generous)
✅ Pricing:          FREE
```

### Render Backend

```
✅ Memory:           512 MB (shared)
✅ Uptime:           99.9% SLA (only if paid - free gets ~50% auto-pause)
⚠️  Auto-Pause:      Free tier spins down after 15 min of inactivity
                    (starts back up when accessed, ~30 sec cold start)
✅ Pricing:          FREE (but has 750 hours/month limit)
```

### MongoDB Atlas

```
✅ Storage:          512 MB (free tier)
✅ Connections:      Limited concurrent connections
✅ Throughput:       Throttled but sufficient for testing
✅ Pricing:          FREE
```

---

## ⚠️ Known Limitations (Free Tier)

### 1. Render Auto-Pause

```
Issue: API goes to sleep after 15 minutes of no traffic
Effect: First request takes ~30 seconds (cold start)
Solution:
  - Keep-alive ping from frontend (every 5 minutes)
  - Or upgrade to paid Render plan (~$7/month)
```

### 2. MongoDB Connection Limits

```
Issue: Free tier limits concurrent connections
Effect: Under heavy load, may see connection errors
Solution:
  - Connection pooling in Fastify (already implemented)
  - Or upgrade to MongoDB paid tier
```

### 3. Vercel Function Timeout

```
Issue: Free tier has no serverless function timeout limit (uses Node.js)
Effect: Long-running AI analysis calls work fine
Solution: Already handled in code (15 second timeout per call)
```

---

## 🚀 Quick Start Checklist

- [ ] **MongoDB Atlas**
  - [ ] Create account
  - [ ] Create cluster
  - [ ] Create database user
  - [ ] Whitelist IPs
  - [ ] Get connection string
  - [ ] Test connection

- [ ] **Render Backend**
  - [ ] Create Render account
  - [ ] Connect GitHub
  - [ ] Create web service for API
  - [ ] Set environment variables
  - [ ] Deploy (wait for ~2 min)
  - [ ] Get service URL
  - [ ] Test health endpoint

- [ ] **Vercel Frontend**
  - [ ] Create Vercel account
  - [ ] Connect GitHub
  - [ ] Import project (root dir: ./apps/web)
  - [ ] Set NEXT_PUBLIC_API_URL to Render service URL
  - [ ] Deploy (wait for ~2 min)
  - [ ] Redeploy to pick up env vars
  - [ ] Get deployment URL
  - [ ] Test pages load

- [ ] **Integration Testing**
  - [ ] Check all 7 pages load
  - [ ] Check API calls work
  - [ ] Test /copilot page
  - [ ] Generate analysis
  - [ ] Check for console errors

---

## 🆘 Troubleshooting

### Frontend Won't Connect to Backend

**Symptom:** Dashboard loads but data doesn't show, console shows network errors  
**Fix:**

```
1. Check Render backend is deployed: https://atc-api-xxxxx.onrender.com/health
2. Verify NEXT_PUBLIC_API_URL is set correctly in Vercel
3. Redeploy Vercel frontend
4. Check browser console for exact error
```

### API Returns 503 Service Unavailable

**Symptom:** API endpoint returns 503  
**Fix:**

```
1. Render free tier auto-pauses - wait 30 seconds for cold start
2. Check Render logs: go to Render dashboard → Logs tab
3. Verify MongoDB connection string is correct
4. Check all environment variables are set
```

### Analysis Takes Very Long

**Symptom:** /copilot analysis takes >15 seconds  
**Fix:**

```
1. AI analysis times out after 15 seconds (by design, in .env)
2. This is normal - falls back to facts-only report
3. If using Gemini, check API_KEY is valid and has quota
```

### Cold Start Issues

**Symptom:** First request to API takes 30+ seconds  
**Fix:**

```
1. This is normal on Render free tier (auto-pause)
2. To reduce: set up keep-alive pings from frontend
3. Or upgrade Render to paid plan (~$7/month)
```

---

## 📈 Monitoring & Logging

### Vercel Dashboard

```
1. Go to https://vercel.com/dashboard
2. Select project → Deployments
3. Click latest deployment
4. View logs in real-time
5. Check build/runtime errors
```

### Render Dashboard

```
1. Go to https://dashboard.render.com
2. Select atc-api service
3. Logs tab: real-time API logs
4. Events tab: deployment history
5. Metrics tab: resource usage
```

### MongoDB Atlas

```
1. Go to https://cloud.mongodb.com
2. Select cluster
3. Collections tab: data browser
4. Monitoring tab: connection stats
5. Logs: query logs (paid tier only)
```

---

## 🔐 Security Notes

### Current Setup (Development)

```
⚠️  Auth disabled (AUTH_MODE=disabled)
⚠️  No session validation
⚠️  No HTTPS enforcement (Vercel/Render both use HTTPS by default)
✅  Rate limiting enabled (120 req/min)
✅  MongoDB connection encrypted (MongoDB Atlas requires HTTPS)
```

### For Production

```
1. Enable authentication (AUTH_MODE=session)
2. Set strong SESSION_SECRET (32+ chars, random)
3. Use HTTPS only (already enabled on Vercel/Render)
4. Restrict MongoDB access to API IP only
5. Enable audit logging in MongoDB
6. Set RATE_LIMIT_MAX to reasonable value
7. Deploy to paid plans (not free tier)
```

---

## 💰 Cost Estimates

### Monthly Cost (Free Tier)

```
Vercel Frontend:       $0 (free tier)
Render Backend:        $0 (free tier, with auto-pause)
MongoDB Atlas:         $0 (free tier, 512MB storage)
────────────────────────────────
TOTAL (Free):          $0/month
```

### Monthly Cost (Recommended Production)

```
Vercel Pro:            $20 (or standard $0 + add-ons)
Render Starter:        $7 (no auto-pause, 2 GB memory)
MongoDB M0:            $0 or M2 shared: $57 (if needed)
────────────────────────────────
TOTAL (Production):    ~$7-30/month
```

---

## 📚 Additional Resources

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Render Docs: https://render.com/docs
- MongoDB Atlas: https://docs.mongodb.com/atlas
- Fastify Docs: https://www.fastify.io/docs/latest

---

## ✅ What's Next?

### Immediately After Deployment

1. Test all pages load
2. Generate AI analysis on /copilot
3. Share URL with team
4. Monitor logs for issues

### Next 24 Hours

1. Set up basic monitoring alerts
2. Check cold start performance
3. Decide on paid upgrades if needed

### Next Week

1. Enable authentication (if needed)
2. Set up backup strategy
3. Plan Phase 7 (Risk & Paper Trading)

---

**Deployment Guide Created:** October 30, 2026  
**Status:** Ready to Deploy  
**Estimated Time:** 20-30 minutes total

Next step: Follow Step 2 (MongoDB Atlas setup)!

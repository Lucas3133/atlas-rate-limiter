# 🚀 CI/CD Guide - Atlas Rate Limiter

**Complete setup for continuous integration and automatic deployment to Render**

---

## 📋 Table of Contents

1. [Render Configuration](#1-render-configuration)
2. [GitHub Actions Configuration](#2-github-actions-configuration)
3. [Deployment Flow](#3-deployment-flow)
4. [Testing and Validation](#4-testing-and-validation)
5. [Troubleshooting](#5-troubleshooting)

---

## 1️⃣ Render Configuration

### **Step 1: Create Render Account**

1. Go to: https://render.com
2. Click **"Get Started"**
3. Connect with your **GitHub** account

### **Step 2: Create Web Service**

1. In the Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your repository: `Lucas3133/atlas-rate-limiter`
3. Configure the service:

```yaml
Name: atlas-rate-limiter
Region: Oregon (or closest to you)
Branch: main
Runtime: Node
Build Command: npm install
Start Command: npm start
Plan: Free (or Starter for 0 downtime)
```

### **Step 3: Configure Environment Variables**

In the Render Dashboard, go to **Environment** and add:

```bash
# ⚠️ REQUIRED
UPSTASH_REDIS_URL=redis://default:YOUR_TOKEN@YOUR_HOST.upstash.io:6379
TRUST_PROXY=1
NODE_ENV=production

# ✅ OPTIONAL (already have default values)
PORT=3000
RATE_LIMIT_CAPACITY=100
RATE_LIMIT_REFILL_RATE=1
```

### **Step 4: Get Deploy Hook URL**

1. In Render, go to **Settings** → **Deploy Hook**
2. Copy the URL (example):
   ```
   https://api.render.com/deploy/srv-xxxxxxxxxxxxx?key=yyyyyyyyyyy
   ```
3. **Save this URL!** We'll use it in GitHub Actions

---

## 2️⃣ GitHub Actions Configuration

### **Step 1: Add Secret in GitHub**

1. Go to your repository: https://github.com/Lucas3133/atlas-rate-limiter
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add:
   - **Name**: `RENDER_DEPLOY_HOOK_URL`
   - **Value**: Paste the Deploy Hook URL from Render
5. Click **"Add secret"**

### **Step 2: Verify Workflows**

Verify the files exist in `.github/workflows/`:

```bash
✅ ci.yml   # Continuous Integration (lint, security, docker build)
✅ cd.yml   # Continuous Deployment (automatic deploy to Render)
```

---

## 3️⃣ Deployment Flow

### **Automatic (Recommended)**

```bash
# When you push to main branch:
git add .
git commit -m "feat: new feature"
git push origin main
```

**What happens:**

```mermaid
1. GitHub receives push to main
   ↓
2. GitHub Actions CI runs (lint, security, docker)
   ↓
3. If CI passes: GitHub Actions CD triggers
   ↓
4. Render receives webhook and starts deploy
   ↓
5. Render builds and deploys automatically
   ↓
6. App available at: https://atlas-rate-limiter.onrender.com
```

### **Manual (Emergency)**

If you need to deploy manually:

```bash
# Option 1: Via GitHub Actions
# Go to: Actions → CD - Deploy to Render → Run workflow

# Option 2: Via Render Dashboard
# Go to: Manual Deploy → Deploy latest commit
```

---

## 4️⃣ Testing and Validation

### **1. Test Health Check**

After deploy, verify the app is running:

```bash
curl https://your-app.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "api": "healthy",
    "redis": "healthy"
  },
  "timestamp": "2025-12-06T12:00:00.000Z"
}
```

### **2. Test Rate Limiting**

```bash
# Public endpoint (100 req/10s)
for i in {1..10}; do
  curl https://your-app.onrender.com/api/public
done

# Login (5 req/5s)
for i in {1..6}; do
  curl -X POST https://your-app.onrender.com/api/login
done
# Last should return 429
```

### **3. Check Metrics**

```bash
curl https://your-app.onrender.com/metrics
```

### **4. Check Logs**

In Render Dashboard:
1. Click on your service
2. Go to **Logs**
3. View in real-time

---

## 5️⃣ Troubleshooting

### **Problem: Deploy Hook not working**

**Symptoms:** Push to main doesn't trigger deploy

**Solution:**
```bash
# 1. Verify secret is configured
# GitHub → Settings → Secrets → RENDER_DEPLOY_HOOK_URL

# 2. Test manually
curl -X POST "https://api.render.com/deploy/srv-xxx?key=yyy"

# 3. Check GitHub Actions logs
# GitHub → Actions → Check error
```

---

### **Problem: Redis connection failed**

**Symptoms:** 
```
❌ REDIS CONNECTION ERROR!
System running in FAIL-OPEN mode
```

**Solution:**
```bash
# 1. Verify UPSTASH_REDIS_URL in Render
# Render → Environment → Check URL

# 2. Correct format:
UPSTASH_REDIS_URL=redis://default:TOKEN@HOST.upstash.io:6379

# 3. Test Upstash connection
# Upstash Console → CLI → PING (should return PONG)
```

---

### **Problem: Build fails on Render**

**Symptoms:** Build shows red on Render

**Solution:**
```bash
# 1. Check build logs on Render
# Look for npm install errors

# 2. Test locally
npm install
npm start

# 3. If it works locally, clear Render cache:
# Settings → Clear build cache & deploy
```

---

### **Problem: App goes to sleep (Free tier)**

**Symptoms:** 
- First request takes 50s+
- Render Free Tier sleeps after 15min inactivity

**Solutions:**

**Option 1: Upgrade to Starter ($7/month)**
- Zero downtime
- Always online

**Option 2: Keep-alive service (Free)**
```bash
# Use a service like UptimeRobot or Cron-job.org
# Ping /health every 10 minutes
```

**Option 3: Warn users**
```javascript
// Add to README:
"⚠️ Free tier: first request may take ~30s"
```

---

## 📊 Workflow Status

### **CI (Continuous Integration)**

Runs on **ALL** pushes and PRs:

```yaml
✅ Lint & Syntax Check
✅ Security Audit (npm audit)
✅ Docker Build Test
```

### **CD (Continuous Deployment)**

Runs **ONLY** on pushes to `main`:

```yaml
✅ Trigger Render Deploy Hook
✅ Success notification
```

---

## 🎯 Configuration Checklist

Before first deploy, confirm:

- [ ] Account created on Render.com
- [ ] GitHub repository connected on Render
- [ ] Web Service created on Render
- [ ] `UPSTASH_REDIS_URL` configured on Render
- [ ] `TRUST_PROXY=1` configured on Render
- [ ] `NODE_ENV=production` configured on Render
- [ ] Deploy Hook URL copied from Render
- [ ] Secret `RENDER_DEPLOY_HOOK_URL` added on GitHub
- [ ] Workflows `.github/workflows/ci.yml` and `cd.yml` committed
- [ ] First push to main completed

---

## 🚀 Complete Deploy Example

```bash
# 1. Make code change
vim src/index.js

# 2. Commit
git add .
git commit -m "feat: add new endpoint"

# 3. Push to main
git push origin main

# 4. Follow progress
# GitHub: https://github.com/Lucas3133/atlas-rate-limiter/actions
# Render: https://dashboard.render.com

# 5. Test after deploy
curl https://atlas-rate-limiter.onrender.com/health

# 6. 🎉 DONE!
```

---

## 📚 Additional Resources

- [Render Docs](https://render.com/docs)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Upstash Redis Docs](https://docs.upstash.com/redis)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)

---

## 🆘 Support

**Issues with the project?**
- 🐛 Open an issue: https://github.com/Lucas3133/atlas-rate-limiter/issues
- 📧 Contact: [your-email@example.com]

**Issues with Render/GitHub?**
- Render Support: https://render.com/support
- GitHub Discussions: https://github.com/orgs/community/discussions

---

**Last updated**: 2025-12-06  
**Version**: 1.0.1  
**Status**: ✅ Production Ready

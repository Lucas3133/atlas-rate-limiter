# 🚀 Deployment Guide - Atlas Rate Limiter

## Option 1: Local Docker

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your UPSTASH_REDIS_URL

# 2. Start container
npm run docker:run

# 3. View logs
npm run docker:logs

# 4. Stop
npm run docker:stop
```

---

## Option 2: Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Click the button above
2. Configure the variables:
```env
UPSTASH_REDIS_URL=redis://...
TRUST_PROXY=1
RATE_LIMIT_REFILL_RATE=1
```
3. Automatic deploy! 🎉

---

## Option 3: Render

1. Go to https://render.com
2. New → Web Service
3. Connect GitHub
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     ```
     UPSTASH_REDIS_URL=...
     TRUST_PROXY=1
     ```

---

## Option 4: Vercel (Serverless)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Configure secrets
vercel env add UPSTASH_REDIS_URL
```

---

## Option 5: Docker Registry (Production)

```bash
# Optimized build
docker build -t atlas-rate-limiter:1.0.0-beta .

# Tag for registry
docker tag atlas-rate-limiter:1.0.0-beta \
  your-username/atlas-rate-limiter:latest

# Push
docker push your-username/atlas-rate-limiter:latest

# Deploy on server
ssh user@server
docker pull your-username/atlas-rate-limiter:latest
docker run -d \
  -p 3000:3000 \
  -e UPSTASH_REDIS_URL="redis://..." \
  -e TRUST_PROXY=1 \
  your-username/atlas-rate-limiter:latest
```

---

## ⚙️ Environment Variables (Production)

| Variable | Recommended Value | Required |
|----------|-------------------|----------|
| `UPSTASH_REDIS_URL` | `redis://...` | ✅ Yes |
| `TRUST_PROXY` | `1` or `true` | ✅ Yes (in production) |
| `RATE_LIMIT_CAPACITY` | `100` | ❌ No (default ok) |
| `RATE_LIMIT_REFILL_RATE` | `1` | ❌ No (default ok) |
| `NODE_ENV` | `production` | ⚠️ Recommended |
| `PORT` | `3000` | ❌ No |

---

## 🔍 Health Check

All platforms should use:
```
GET /health
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "api": "healthy",
    "redis": "healthy"
  }
}
```

---

## 📊 Monitoring

### Logs
```bash
# Docker
docker-compose logs -f

# Railway/Render
# Use the web interface
```

### Metrics (FEAT-001)
```
GET /metrics  # Prometheus format
```

# 🧪 Testing Guide - Atlas Rate Limiter v1.0.0-beta

## ✅ Complete Validation Checklist

Run these tests after implementing ALL phases (1, 2 and 3).

---

## 📋 PHASE 1: HOTFIXES - Basic Tests

### ✅ FIX-001: Validate Refill Rate
```bash
# 1. Confirm .env has RATE_LIMIT_REFILL_RATE=1
cat .env | grep REFILL

# 2. Start server
npm start

# 3. Check startup log (should show "@1/s")
# Expected output: "⚡ Token Bucket: 100 tokens @ 1/s"
```

### ✅ FIX-002: Validate Trust Proxy
```bash
# 1. Confirm .env has TRUST_PROXY=false (local dev)
cat .env | grep TRUST_PROXY

# 2. Start server and check log
npm start

# Expected output: "🔒 Trust Proxy: false"
```

### ✅ FIX-003: Dynamic Port Test
```bash
# Terminal 1: Run on port 8080
$env:PORT=8080; npm start

# Terminal 2: Load test should use correct port
node tests/load/loadTest.js

# Should connect to localhost:8080 (not 3000)
```

---

## 🐳 PHASE 2: PROFESSIONALIZATION - DevOps Tests

### ✅ OPS-001: Docker Build & Run
```bash
# 1. Build image
npm run docker:build

# 2. Check size (~150MB expected)
docker images | grep atlas-rate-limiter

# 3. Run container
npm run docker:run

# 4. Check health
curl http://localhost:3000/health

# 5. View logs
npm run docker:logs

# 6. Stop
npm run docker:stop
```

### ✅ SEC-003: Static File Protection
```bash
# 1. Access HTML dashboard
open http://localhost:3000

# 2. Verify it loads (no rate limit blocking)
# 3. Try F5 about 20x fast - should keep working
# (Real protection comes from CDN in production)
```

### ✅ QA-001: GitHub Actions CI
```bash
# 1. Push to GitHub
git add .
git commit -m "feat: phases 1, 2 and 3 complete"
git push origin main

# 2. Go to GitHub > Actions
# 3. Verify pipeline ran successfully:
#    - ✅ Lint & Syntax
#    - ✅ Security Audit  
#    - ✅ Docker Build
```

---

## 🚀 PHASE 3: SENIOR ARCHITECTURE - Advanced Tests

### ✅ ARCH-001: Clock Drift Prevention
```bash
# This test validates that multiple servers don't desynchronize

# Terminal 1: Server on port 3000
npm start

# Terminal 2: Make 10 requests in 5 seconds
for ($i=0; $i -lt 10; $i++) {
    curl http://localhost:3000/api/login-test
    Start-Sleep -Milliseconds 500
}

# Check X-RateLimit-Reset headers
# All should use Redis timestamp (consistent)
```

### ✅ PERF-001: Script Caching (EVALSHA)
```bash
# 1. Run server with Redis logs (if local)
npm start

# 2. First request - loads script
curl -v http://localhost:3000/api/public

# 3. Second request - uses EVALSHA (cache)
curl -v http://localhost:3000/api/public

# Benefit: Saves ~3KB per request
# Check in Redis Monitor (if you have access):
# redis-cli monitor
# Should see EVALSHA instead of EVAL after first time
```

### ✅ FEAT-001: Prometheus Metrics
```bash
# 1. Make some requests to generate metrics
curl http://localhost:3000/api/public  # 5x allowed
curl http://localhost:3000/api/login-test  # 10x (8 blocked)

# 2. Access /metrics
curl http://localhost:3000/metrics

# Expected output (Prometheus format):
# atlas_requests_allowed_total 5
# atlas_requests_blocked_total 8
# atlas_active_clients 1
# atlas_block_rate_percent 61.54
# atlas_response_time_ms{quantile="0.95"} 12.34
```

---

## 🔥 COMPLETE LOAD TEST

```bash
# Terminal 1: Server running
npm start

# Terminal 2: Load test (150 requests)
node tests/load/loadTest.js

# Expected output:
# ✅ Allowed: ~100
# 🚫 Blocked (429): ~50
# ❌ Errors: 0
# ⏱️ Duration: ~15s
```

Expected results:
- Block rate: ~30-40%
- First 100 requests pass
- Then blocks until refill (1 token/s)

---

## 📊 VISUAL TEST: HTML Dashboard

```bash
# 1. Open dashboard
open http://localhost:3000

# 2. Click "Quick Test" button
# 3. Click 20x fast
# 4. Verify some return 429 (blocked)
# 5. See "Blocked Requests" counter increase
```

---

## 🔍 SECURITY TESTS

### ✅ Fail-Open (Redis Offline)
```bash
# 1. Stop Redis (or use invalid URL in .env)
# UPSTASH_REDIS_URL=redis://fake:fake@fake.io:6379

# 2. Start server
npm start

# 3. Make request
curl http://localhost:3000/api/public

# Expected: 200 OK (allows with warning in log)
# Log: "⚠️ rate_limit_fail_open"
```

### ✅ IP Spoofing Protection
```bash
# 1. With TRUST_PROXY=false (local dev)
curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:3000/api/public

# 2. Rate limiter should use real IP, NOT the forged one
# 3. Make 150 requests - should block based on real IP
```

---

## 📈 PERFORMANCE TEST

```powershell
# PowerShell - 1000 concurrent requests
$jobs = @()
for ($i=0; $i -lt 1000; $i++) {
    $jobs += Start-Job { 
        Invoke-WebRequest -Uri "http://localhost:3000/api/public" 
    }
}
$jobs | Wait-Job | Receive-Job

# Verify:
# - Server didn't crash
# - Metrics show correct numbers
```

---

## ✅ FINAL CHECKLIST - Complete Validation

| Category | Test | Status |
|----------|------|--------|
| **Phase 1** | Refill Rate = 1 | ☐ |
| **Phase 1** | Dynamic Trust Proxy | ☐ |
| **Phase 1** | Dynamic port (loadTest) | ☐ |
| **Phase 2** | Docker build < 200MB | ☐ |
| **Phase 2** | Docker Compose starts ok | ☐ |
| **Phase 2** | GitHub Actions CI passes | ☐ |
| **Phase 3** | Clock drift via redis.TIME | ☐ |
| **Phase 3** | EVALSHA caching active | ☐ |
| **Phase 3** | /metrics returns Prometheus | ☐ |
| **Security** | Fail-open works | ☐ |
| **Security** | IP spoofing blocked | ☐ |
| **Performance** | Load test passes | ☐ |
| **UX** | HTML Dashboard works | ☐ |

---

## 🎯 SUCCESS CRITERIA

### ✅ Minimum Acceptable (MVP)
- [x] All Phase 1 tests pass
- [x] Server starts without errors
- [x] Rate limiting works (blocks excess)
- [x] Fail-open active (security)

### ✅ Production Ready (Recommended)
- [x] MVP +
- [x] Docker works
- [x] CI/CD configured
- [x] Prometheus metrics working

### ✅ Enterprise Grade (Ideal)
- [x] Production Ready +
- [x] Clock drift fixed
- [x] Script caching optimized
- [x] 1000+ request load test passes
- [x] Complete documentation (README, DEPLOY, ARCH)

---

## 🚨 Troubleshooting

### Error: "UPSTASH_REDIS_URL not configured"
```bash
# Copy .env.example to .env
cp .env.example .env
# Edit .env with your Upstash credentials
```

### Error: "Port 3000 already in use"
```bash
# Use another port
$env:PORT=8080; npm start
```

### Error: "Docker build failed"
```bash
# Verify that node_modules is not in .dockerignore
# Rebuild without cache
docker build --no-cache -t atlas-rate-limiter .
```

---

## 📞 Support

If any test fails:
1. Check server logs (`npm start`)
2. Verify `.env` (correct variables?)
3. Validate Redis connection (Upstash active?)
4. See `ARCHITECTURE.md` for technical details

**Tested version**: Node.js 20, Redis 7+

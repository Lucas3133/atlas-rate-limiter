# 🛡️ Atlas Rate Limiter

[![CI Status](https://github.com/Lucas3133/atlas-rate-limiter/workflows/CI%20-%20Atlas%20Rate%20Limiter/badge.svg)](https://github.com/Lucas3133/atlas-rate-limiter/actions)
[![Deploy Status](https://img.shields.io/badge/render-deployed-success?logo=render)](https://atlas-rate-limiter.onrender.com)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Redis](https://img.shields.io/badge/redis-upstash-red?logo=redis)](https://upstash.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)](https://hub.docker.com)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

> **High-performance distributed rate limiter** using Redis + Token Bucket Algorithm. Perfect for protecting your APIs against abuse, DDoS attacks, and ensuring fair usage.

---

## ✨ Features

- 🪣 **Token Bucket Algorithm** - Industry-standard rate limiting with burst support
- ⚡ **High Performance** - Atomic Lua scripts with EVALSHA caching
- 🔄 **Distributed** - Works across multiple servers with Redis
- 🛡️ **Fail-Open** - Maintains availability even if Redis is down
- 📊 **Prometheus Metrics** - Built-in monitoring endpoint
- 🐳 **Docker Ready** - Production-ready containerization
- 🔒 **Secure** - Anti IP-spoofing, API key hashing, configurable trust proxy
- 📱 **Interactive Dashboard** - Beautiful real-time monitoring UI

---

## 🌐 Live Demo

**✨ Try it live:** [https://atlas-rate-limiter.onrender.com](https://atlas-rate-limiter.onrender.com)

![Atlas Rate Limiter Dashboard](https://raw.githubusercontent.com/Lucas3133/atlas-rate-limiter/main/.github/screenshots/dashboard.png)

*Interactive dashboard with real-time metrics, rate limiting statistics, and test endpoints*

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
# 1. Configure .env
cp .env.example .env
# Edit .env with your Upstash credentials

# 2. Start container
docker-compose up -d

# 3. Access
open http://localhost:3000
```

### Option 2: Local Node.js
```bash
# 1. Install dependencies
npm install

# 2. Configure .env
cp .env.example .env

# 3. Run
npm start
```

---

## 📦 Production Deployment

### 🚀 Automatic CI/CD (Recommended)
```bash
# Push to main triggers automatic deployment
git push origin main

# ✅ Automatic deployment via GitHub Actions!
```

📚 **Complete Guide**: [CI_CD_SETUP.md](docs/CI_CD_SETUP.md)

### Railway / Render / Vercel
```bash
# Configure these environment variables:
UPSTASH_REDIS_URL=redis://...
RATE_LIMIT_CAPACITY=100
RATE_LIMIT_REFILL_RATE=1
TRUST_PROXY=1  # ⚠️ Important!
```

---

## 📡 API Endpoints

| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| `GET` | `/health` | None | Health check |
| `GET` | `/metrics` | 50 req/10s | Prometheus metrics |
| `GET` | `/api/public` | 100 req/10s | Public endpoint |
| `POST` | `/api/login` | 5 req/5s | Login (restrictive) |
| `GET` | `/api/admin` | 1000 req/10s | Admin (permissive) |

---

## 🧪 Testing

### Local Load Testing
```bash
# Terminal 1: Run server
npm start

# Terminal 2: Execute test
node tests/load/loadTest.js
```

📚 **Complete Testing Guide**: [TESTING.md](docs/TESTING.md)

---

## 🔒 Security

✅ **Implemented:**
- Secure Refill Rate (1 token/s default)
- Configurable Trust Proxy
- `/metrics` endpoint protected with rate limit
- `/api/no-limit` route restricted to development
- Improved Redis reconnection (60 attempts, 10 min)
- Static file protection
- Dockerfile with non-root user
- API key hashing (SHA-256)
- Anti IP-spoofing



---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `UPSTASH_REDIS_URL` | - | **Required** - Redis URL |
| `RATE_LIMIT_CAPACITY` | `100` | Bucket capacity (tokens) |
| `RATE_LIMIT_REFILL_RATE` | `1` | Tokens per second |
| `TRUST_PROXY` | `false` | `false`/`1`/`true` |
| `PORT` | `3000` | Server port |

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Express.js  │────▶│   Redis     │
│  Request    │     │  Middleware  │     │  (Upstash)  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                    Token Bucket
                    Algorithm (Lua)
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
         ✅ ALLOW                  🚫 429 BLOCK
         (has tokens)              (no tokens)
```

📚 **Detailed Architecture**: [ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 📊 Prometheus Metrics

```bash
curl http://localhost:3000/metrics
```

```
# Available metrics
atlas_requests_allowed_total     # Allowed requests
atlas_requests_blocked_total     # Blocked requests (429)
atlas_active_clients             # Unique active clients
atlas_block_rate_percent         # Block rate percentage
atlas_response_time_ms           # Response time (p50, p95, p99)
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture & decisions |
| [DEPLOY.md](docs/DEPLOY.md) | Deployment guides (5 platforms) |
| [TESTING.md](docs/TESTING.md) | Complete testing checklist |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |
| [CI_CD_SETUP.md](docs/CI_CD_SETUP.md) | CI/CD configuration |

---

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# 1. Fork the project
# 2. Create a branch
git checkout -b feature/amazing-feature

# 3. Commit
git commit -m "feat: add amazing feature"

# 4. Push
git push origin feature/amazing-feature

# 5. Open a Pull Request
```

---

## 🙏 Acknowledgments

- [Redis](https://redis.io/) - In-memory data store
- [Upstash](https://upstash.com/) - Serverless Redis
- [Express.js](https://expressjs.com/) - Web framework
- [ioredis](https://github.com/redis/ioredis) - Redis client

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⭐ Show Your Support

If this project helped you, please give it a ⭐ on GitHub!

---

<p align="center">
  Made with 💜 by <a href="https://github.com/Lucas3133">Lucas</a>
</p>

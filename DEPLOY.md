# 🚀 Guia de Deploy - Atlas Rate Limiter

## Opção 1: Docker Local

```bash
# 1. Configurar ambiente
cp .env.example .env
# Edite .env com seu UPSTASH_REDIS_URL

# 2. Subir container
npm run docker:run

# 3. Ver logs
npm run docker:logs

# 4. Parar
npm run docker:stop
```

---

## Opção 2: Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Clique no botão acima
2. Configure as variáveis:
```env
UPSTASH_REDIS_URL=redis://...
TRUST_PROXY=1
RATE_LIMIT_REFILL_RATE=1
```
3. Deploy automático! 🎉

---

## Opção 3: Render

1. Vá em https://render.com
2. New → Web Service
3. Conecte o GitHub
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     ```
     UPSTASH_REDIS_URL=...
     TRUST_PROXY=1
     ```

---

## Opção 4: Vercel (Serverless)

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Configurar secrets
vercel env add UPSTASH_REDIS_URL
```

---

## Opção 5: Docker Registry (Produção)

```bash
# Build otimizado
docker build -t atlas-rate-limiter:1.0.0-beta .

# Tag para registry
docker tag atlas-rate-limiter:1.0.0-beta \
  seu-usuario/atlas-rate-limiter:latest

# Push
docker push seu-usuario/atlas-rate-limiter:latest

# Deploy em servidor
ssh user@servidor
docker pull seu-usuario/atlas-rate-limiter:latest
docker run -d \
  -p 3000:3000 \
  -e UPSTASH_REDIS_URL="redis://..." \
  -e TRUST_PROXY=1 \
  seu-usuario/atlas-rate-limiter:latest
```

---

## ⚙️ Variáveis de Ambiente (Produção)

| Variável | Valor Recomendado | Obrigatório |
|----------|-------------------|-------------|
| `UPSTASH_REDIS_URL` | `redis://...` | ✅ Sim |
| `TRUST_PROXY` | `1` ou `true` | ✅ Sim (em produção) |
| `RATE_LIMIT_CAPACITY` | `100` | ❌ Não (padrão ok) |
| `RATE_LIMIT_REFILL_RATE` | `1` | ❌ Não (padrão ok) |
| `NODE_ENV` | `production` | ⚠️ Recomendado |
| `PORT` | `3000` | ❌ Não |

---

## 🔍 Health Check

Todas as plataformas devem usar:
```
GET /health
```

Resposta esperada:
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

## 📊 Monitoramento

### Logs
```bash
# Docker
docker-compose logs -f

# Railway/Render
# Use a interface web
```

### Métricas (Futuro - FEAT-001)
```
GET /metrics  # Prometheus format
```

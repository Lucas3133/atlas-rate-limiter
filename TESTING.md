# 🧪 Guia de Testes - Atlas Rate Limiter v1.0.0-beta

## ✅ Checklist Completo de Validação

Execute estes testes após implementar TODAS as fases (1, 2 e 3).

---

## 📋 FASE 1: HOTFIXES - Testes Básicos

### ✅ FIX-001: Validar Refill Rate
```bash
# 1. Confirmar que .env tem RATE_LIMIT_REFILL_RATE=1
cat .env | grep REFILL

# 2. Iniciar servidor
npm start

# 3. Verificar startup log (deve mostrar "@1/s")
# Output esperado: "⚡ Token Bucket: 100 fichas @ 1/s"
```

### ✅ FIX-002: Validar Trust Proxy
```bash
# 1. Confirmar que .env tem TRUST_PROXY=false (local dev)
cat .env | grep TRUST_PROXY

# 2. Iniciar servidor e checar log
npm start

# Output esperado: "🔒 Trust Proxy: false"
```

### ✅ FIX-003: Teste de Porta Dinâmica
```bash
# Terminal 1: Rodar na porta 8080
$env:PORT=8080; npm start

# Terminal 2: Teste de carga deve usar porta correta
node tests/load/loadTest.js

# Deve conectar em localhost:8080 (não 3000)
```

---

## 🐳 FASE 2: PROFISSIONALIZAÇÃO - Testes DevOps

### ✅ OPS-001: Docker Build & Run
```bash
# 1. Build da imagem
npm run docker:build

# 2. Verificar tamanho (~150MB esperado)
docker images | grep atlas-rate-limiter

# 3. Rodar container
npm run docker:run

# 4. Verificar health check
curl http://localhost:3000/health

# 5. Ver logs
npm run docker:logs

# 6. Parar
npm run docker:stop
```

### ✅ SEC-003: Proteção de Arquivos Estáticos
```bash
# 1. Acessar dashboard HTML
open http://localhost:3000

# 2. Verificar que carrega (não tem rate limit bloqueando)
# 3. Tentar F5 umas 20x rápido - deve continuar funcionando
# (Proteção real virá do CDN em produção)
```

### ✅ QA-001: GitHub Actions CI
```bash
# 1. Push para GitHub
git add .
git commit -m "feat: fase 1, 2 e 3 completas"
git push origin main

# 2. Ir no GitHub > Actions
# 3. Verificar que pipeline rodou com sucesso:
#    - ✅ Lint & Syntax
#    - ✅ Security Audit  
#    - ✅ Docker Build
```

---

## 🚀 FASE 3: ARQUITETURA SÊNIOR - Testes Avançados

### ✅ ARCH-001: Clock Drift Prevention
```bash
# Este teste valida que múltiplos servidores não dessincroni zam

# Terminal 1: Servidor na porta 3000
npm start

# Terminal 2: Fazer 10 requisições em 5 segundos
for ($i=0; $i -lt 10; $i++) {
    curl http://localhost:3000/api/login-test
    Start-Sleep -Milliseconds 500
}

# Verificar headers X-RateLimit-Reset
# Todos devem usar timestamp do Redis (consistente)
```

### ✅ PERF-001: Script Caching (EVALSHA)
```bash
# 1. Rodar servidor com logs Redis (se local)
npm start

# 2. Primeira requisição - carrega script
curl -v http://localhost:3000/api/public

# 3. Segunda requisição - usa EVALSHA (cache)
curl -v http://localhost:3000/api/public

# Benefício: Economiza ~3KB por request
# Verificar no Redis Monitor (se tiver acesso):
# redis-cli monitor
# Deve ver EVALSHA em vez de EVAL após primeira vez
```

### ✅ FEAT-001: Prometheus Metrics
```bash
# 1. Fazer algumas requisições para gerar métricas
curl http://localhost:3000/api/public  # 5x permitidas
curl http://localhost:3000/api/login-test  # 10x (8 bloqueadas)

# 2. Acessar /metrics
curl http://localhost:3000/metrics

# Output esperado (formato Prometheus):
# atlas_requests_allowed_total 5
# atlas_requests_blocked_total 8
# atlas_active_clients 1
# atlas_block_rate_percent 61.54
# atlas_response_time_ms{quantile="0.95"} 12.34
```

---

## 🔥 TESTE DE CARGA COMPLETO

```bash
# Terminal 1: Servidor rodando
npm start

# Terminal 2: Teste de carga (150 requests)
node tests/load/loadTest.js

# Output esperado:
# ✅ Permitidas: ~100
# 🚫 Bloqueadas (429): ~50
# ❌ Erros: 0
# ⏱️ Duração: ~15s
```

Resultados esperados:
- Taxa de bloqueio: ~30-40%
- Primeiras 100 requests passam
- Depois bloqueia até recarregar (1 ficha/s)

---

## 📊 TESTE VISUAL: Dashboard HTML

```bash
# 1. Abrir dashboard
open http://localhost:3000

# 2. Clicar no botão "Teste Rápido (Rate Limit Leve)"
# 3. Clicar 20x rápido
# 4. Verificar que algumas voltam 429 (bloqueadas)
# 5. Ver contador de "Requests Bloqueadas" aumentar
```

---

## 🔍 TESTES DE SEGURANÇA

### ✅ Fail-Open (Redis Offline)
```bash
# 1. Parar Redis (ou usar URL inválida no .env)
# UPSTASH_REDIS_URL=redis://fake:fake@fake.io:6379

# 2. Iniciar servidor
npm start

# 3. Fazer requisição
curl http://localhost:3000/api/public

# Esperado: 200 OK (permite com warning no log)
# Log: "⚠️ rate_limit_fail_open"
```

### ✅ IP Spoofing Protection
```bash
# 1. Com TRUST_PROXY=false (local dev)
curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:3000/api/public

# 2. Rate limiter deve usar IP real, NÃO o forjado
# 3. Fazer 150 requests - deve bloquear baseado no IP real
```

---

## 📈 TESTE DE PERFORMANCE

```powershell
# PowerShell - 1000 requests concorrentes
$jobs = @()
for ($i=0; $i -lt 1000; $i++) {
    $jobs += Start-Job { 
        Invoke-WebRequest -Uri "http://localhost:3000/api/public" 
    }
}
$jobs | Wait-Job | Receive-Job

# Verificar:
# - Servidor não crashed
# - Métricas mostram números corretos
```

---

## ✅ CHECKLIST FINAL - Validação Completa

| Categoria | Teste | Status |
|-----------|-------|--------|
| **Fase 1** | Refill Rate = 1 | ☐ |
| **Fase 1** | Trust Proxy dinâmico | ☐ |
| **Fase 1** | Porta dinâmica (loadTest) | ☐ |
| **Fase 2** | Docker build < 200MB | ☐ |
| **Fase 2** | Docker Compose sobe ok | ☐ |
| **Fase 2** | GitHub Actions CI passa | ☐ |
| **Fase 3** | Clock drift via redis.TIME | ☐ |
| **Fase 3** | EVALSHA caching ativo | ☐ |
| **Fase 3** | /metrics retorna Prometheus | ☐ |
| **Segurança** | Fail-open funciona | ☐ |
| **Segurança** | IP spoofing bloqueado | ☐ |
| **Performance** | Teste de carga passa | ☐ |
| **UX** | Dashboard HTML funciona | ☐ |

---

## 🎯 CRITÉRIOS DE SUCESSO

### ✅ Mínimo Aceitável (MVP)
- [x] Todos testes Fase 1 passam
- [x] Servidor inicia sem erros
- [x] Rate limiting funciona (bloqueia excesso)
- [x] Fail-open ativo (segurança)

### ✅ Production Ready (Recomendado)
- [x] MVP +
- [x] Docker funciona
- [x] CI/CD configurado
- [x] Métricas Prometheus funcionando

### ✅ Enterprise Grade (Ideal)
- [x] Production Ready +
- [x] Clock drift corrigido
- [x] Script caching otimizado
- [x] Teste de carga 1000+ requests passa
- [x] Documentação completa (README, DEPLOY, ARCH)

---

## 🚨 Troubleshooting

### Erro: "UPSTASH_REDIS_URL não configurado"
```bash
# Copiar .env.example para .env
cp .env.example .env
# Editar .env com suas credenciais Upstash
```

### Erro: "Port 3000 already in use"
```bash
# Usar outra porta
$env:PORT=8080; npm start
```

### Erro: "Docker build failed"
```bash
# Verificar que node_modules não está em .dockerignore
# Rebuild sem cache
docker build --no-cache -t atlas-rate-limiter .
```

---

## 📞 Suporte

Se algum teste falhar:
1. Verificar logs do servidor (`npm start`)
2. Checar `.env` (variáveis corretas?)
3. Validar conexão Redis (Upstash ativo?)
4. Ver `ARCHITECTURE.md` para detalhes técnicos

**Versão testada**: Node.js 20, Redis 7+

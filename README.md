# 🛡️ Atlas Rate Limiter (Shield)

[![CI Status](https://github.com/seu-usuario/atlas-rate-limiter/workflows/CI/badge.svg)](https://github.com/seu-usuario/atlas-rate-limiter/actions)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://hub.docker.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> Rate limiter distribuído de alta performance usando Redis + Token Bucket Algorithm

## 🚀 Quick Start

### Opção 1: Docker (Recomendado)
```bash
# 1. Configure o .env
cp .env.example .env
# Edite .env com suas credenciais Upstash

# 2. Suba o container
docker-compose up -d

# 3. Acesse
open http://localhost:3000
```

### Opção 2: Node.js Local
```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env
cp .env.example .env

# 3. Rodar
npm start
```

## 📦 Deploy em Produção

### Railway / Render / Vercel
```bash
# Configure estas variáveis de ambiente:
UPSTASH_REDIS_URL=redis://...
RATE_LIMIT_CAPACITY=100
RATE_LIMIT_REFILL_RATE=1
TRUST_PROXY=1  # ⚠️ Importante!
```

### Docker Registry
```bash
# Build
docker build -t atlas-rate-limiter:latest .

# Push (exemplo Docker Hub)
docker tag atlas-rate-limiter:latest seu-usuario/atlas-rate-limiter:latest
docker push seu-usuario/atlas-rate-limiter:latest
```

## 🧪 Testes

### Teste de Carga Local
```bash
# Terminal 1: Rodar servidor
npm start

# Terminal 2: Executar teste
node tests/load/loadTest.js
```

## 🔒 Segurança

✅ **Implementado:**
- FIX-001: Refill Rate seguro (1 ficha/s)
- FIX-002: Trust Proxy configurável
- FIX-003: Testes com porta dinâmica
- SEC-003: Proteção de arquivos estáticos
- Dockerfile com usuário não-root
- GitHub Actions CI/CD

⏳ **Roadmap:**
- ARCH-001: Clock drift correction (Redis TIME)
- PERF-001: Script caching (EVALSHA)
- FEAT-001: Métricas Prometheus

## 📊 Configuração

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `UPSTASH_REDIS_URL` | - | **Obrigatório** - URL do Redis |
| `RATE_LIMIT_CAPACITY` | `100` | Capacidade do balde |
| `RATE_LIMIT_REFILL_RATE` | `1` | Fichas/segundo (FIX-001) |
| `TRUST_PROXY` | `false` | `false`/`1`/`true` (FIX-002) |
| `PORT` | `3000` | Porta da API |

## 📚 Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitetura detalhada
- [.env.example](.env.example) - Template de configuração

## 🤝 Contribuindo

```bash
# 1. Fork o projeto
# 2. Crie uma branch
git checkout -b feature/minha-feature

# 3. Commit
git commit -m "feat: minha feature incrível"

# 4. Push
git push origin feature/minha-feature

# 5. Abra um Pull Request
```

## 📄 Licença

MIT © 2025 Atlas Shield Team

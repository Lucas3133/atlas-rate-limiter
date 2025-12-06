# 🚀 Guia de CI/CD - Atlas Rate Limiter

**Configuração completa de integração contínua e deploy automático no Render**

---

## 📋 Índice

1. [Configuração do Render](#1-configuração-do-render)
2. [Configuração do GitHub Actions](#2-configuração-do-github-actions)
3. [Fluxo de Deploy](#3-fluxo-de-deploy)
4. [Testes e Validação](#4-testes-e-validação)
5. [Troubleshooting](#5-troubleshooting)

---

## 1️⃣ Configuração do Render

### **Passo 1: Criar Conta no Render**

1. Acesse: https://render.com
2. Clique em **"Get Started"**
3. Conecte com sua conta **GitHub**

### **Passo 2: Criar Web Service**

1. No dashboard do Render, clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório: `Lucas3133/atlas-rate-limiter`
3. Configure o serviço:

```yaml
Name: atlas-rate-limiter
Region: Oregon (ou mais próximo de você)
Branch: main
Runtime: Node
Build Command: npm install
Start Command: npm start
Plan: Free (ou Starter se quiser 0 downtime)
```

### **Passo 3: Configurar Variáveis de Ambiente**

No Render Dashboard, vá em **Environment** e adicione:

```bash
# ⚠️ OBRIGATÓRIAS
UPSTASH_REDIS_URL=redis://default:SEU_TOKEN@SEU_HOST.upstash.io:6379
TRUST_PROXY=1
NODE_ENV=production

# ✅ OPCIONAIS (já tem valores padrão)
PORT=3000
RATE_LIMIT_CAPACITY=100
RATE_LIMIT_REFILL_RATE=1
```

### **Passo 4: Obter Deploy Hook URL**

1. No Render, vá em **Settings** → **Deploy Hook**
2. Copie a URL (exemplo):
   ```
   https://api.render.com/deploy/srv-xxxxxxxxxxxxx?key=yyyyyyyyyyy
   ```
3. **Guarde essa URL!** Vamos usar no GitHub Actions

---

## 2️⃣ Configuração do GitHub Actions

### **Passo 1: Adicionar Secret no GitHub**

1. Vá no seu repositório: https://github.com/Lucas3133/atlas-rate-limiter
2. Clique em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **"New repository secret"**
4. Adicione:
   - **Name**: `RENDER_DEPLOY_HOOK_URL`
   - **Value**: Cole a URL do Deploy Hook do Render
5. Clique em **"Add secret"**

### **Passo 2: Verificar Workflows**

Verifique se os arquivos existem em `.github/workflows/`:

```bash
✅ ci.yml   # Continuous Integration (lint, security, docker build)
✅ cd.yml   # Continuous Deployment (deploy automático no Render)
```

---

## 3️⃣ Fluxo de Deploy

### **Automático (Recomendado)**

```bash
# Quando você fizer push na branch main:
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```

**O que acontece:**

```mermaid
1. GitHub recebe push na main
   ↓
2. GitHub Actions CI roda (lint, security, docker)
   ↓
3. Se CI passar: GitHub Actions CD dispara
   ↓
4. Render recebe webhook e inicia deploy
   ↓
5. Render faz build e deploy automático
   ↓
6. App fica disponível em: https://atlas-rate-limiter.onrender.com
```

### **Manual (Emergência)**

Se precisar fazer deploy manual:

```bash
# Opção 1: Via GitHub Actions
# Vá em: Actions → CD - Deploy to Render → Run workflow

# Opção 2: Via Render Dashboard
# Vá em: Manual Deploy → Deploy latest commit
```

---

## 4️⃣ Testes e Validação

### **1. Testar Health Check**

Após deploy, verifique se o app está rodando:

```bash
curl https://seu-app.onrender.com/health
```

Resposta esperada:
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

### **2. Testar Rate Limiting**

```bash
# Endpoint público (100 req/10s)
for i in {1..10}; do
  curl https://seu-app.onrender.com/api/public
done

# Login (5 req/5s)
for i in {1..6}; do
  curl -X POST https://seu-app.onrender.com/api/login
done
# Último deve retornar 429
```

### **3. Verificar Métricas**

```bash
curl https://seu-app.onrender.com/metrics
```

### **4. Verificar Logs**

No Render Dashboard:
1. Clique no seu serviço
2. Vá em **Logs**
3. Veja em tempo real

---

## 5️⃣ Troubleshooting

### **Problema: Deploy Hook não funciona**

**Sintomas:** Push na main não dispara deploy

**Solução:**
```bash
# 1. Verificar se secret está configurado
# GitHub → Settings → Secrets → RENDER_DEPLOY_HOOK_URL

# 2. Testar manualmente
curl -X POST "https://api.render.com/deploy/srv-xxx?key=yyy"

# 3. Verificar logs do GitHub Actions
# GitHub → Actions → Verificar erro
```

---

### **Problema: Redis connection failed**

**Sintomas:** 
```
❌ ERRO AO CONECTAR REDIS!
Sistema rodando em FAIL-OPEN mode
```

**Solução:**
```bash
# 1. Verificar UPSTASH_REDIS_URL no Render
# Render → Environment → Verificar URL

# 2. Formato correto:
UPSTASH_REDIS_URL=redis://default:TOKEN@HOST.upstash.io:6379

# 3. Testar conexão Upstash
# Upstash Console → CLI → PING (deve retornar PONG)
```

---

### **Problema: Build falha no Render**

**Sintomas:** Build fica vermelho no Render

**Solução:**
```bash
# 1. Verificar logs de build no Render
# Procurar por erros de npm install

# 2. Testar localmente
npm install
npm start

# 3. Se funcionar local, limpar cache do Render:
# Settings → Clear build cache & deploy
```

---

### **Problema: App fica em sleep (Free tier)**

**Sintomas:** 
- Primeira requisição demora 50s+
- Render Free Tier dorme após 15min inatividade

**Soluções:**

**Opção 1: Upgrade para Starter ($7/mês)**
- Zero downtime
- Sempre online

**Opção 2: Keep-alive service (Free)**
```bash
# Use serviço tipo UptimeRobot ou Cron-job.org
# Fazer ping a cada 10 minutos em /health
```

**Opção 3: Avisar usuários**
```javascript
// Adicionar no README:
"⚠️ Free tier: primeira requisição pode demorar ~30s"
```

---

## 📊 Status dos Workflows

### **CI (Continuous Integration)**

Roda em **TODOS** os pushes e PRs:

```yaml
✅ Lint & Syntax Check
✅ Security Audit (npm audit)
✅ Docker Build Test
```

### **CD (Continuous Deployment)**

Roda **APENAS** em pushes na `main`:

```yaml
✅ Trigger Render Deploy Hook
✅ Notificação de sucesso
```

---

## 🎯 Checklist de Configuração

Antes de fazer o primeiro deploy, confirme:

- [ ] Conta criada no Render.com
- [ ] Repositório GitHub conectado no Render
- [ ] Web Service criado no Render
- [ ] `UPSTASH_REDIS_URL` configurado no Render
- [ ] `TRUST_PROXY=1` configurado no Render
- [ ] `NODE_ENV=production` configurado no Render
- [ ] Deploy Hook URL copiado do Render
- [ ] Secret `RENDER_DEPLOY_HOOK_URL` adicionado no GitHub
- [ ] Workflows `.github/workflows/ci.yml` e `cd.yml` commitados
- [ ] Primeiro push na main realizado

---

## 🚀 Exemplo Completo de Deploy

```bash
# 1. Fazer mudança no código
vim src/index.js

# 2. Commitar
git add .
git commit -m "feat: adicionar novo endpoint"

# 3. Push para main
git push origin main

# 4. Acompanhar progresso
# GitHub: https://github.com/Lucas3133/atlas-rate-limiter/actions
# Render: https://dashboard.render.com

# 5. Testar após deploy
curl https://atlas-rate-limiter.onrender.com/health

# 6. 🎉 PRONTO!
```

---

## 📚 Recursos Adicionais

- [Render Docs](https://render.com/docs)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Upstash Redis Docs](https://docs.upstash.com/redis)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)

---

## 🆘 Suporte

**Problemas com o projeto?**
- 🐛 Abra uma issue: https://github.com/Lucas3133/atlas-rate-limiter/issues
- 📧 Contato: [seu-email@exemplo.com]

**Problemas com Render/GitHub?**
- Render Support: https://render.com/support
- GitHub Discussions: https://github.com/orgs/community/discussions

---

**Última atualização**: 2025-12-06  
**Versão**: 1.0.1  
**Status**: ✅ Production Ready

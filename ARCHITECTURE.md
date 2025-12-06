# 🏗️ Atlas Rate Limiter - Arquitetura Técnica

## 📋 Documentação Original

Esta implementação segue fielmente a especificação técnica fornecida, implementando todos os requisitos P0 e P1.

## 🎯 Decisões Arquiteturais

### **1. Token Bucket Algorithm**

**Por que Token Bucket e não Sliding Window?**

```
Token Bucket:
✅ Permite bursts controlados
✅ Mais justo (recarga contínua)
✅ Implementação atômica simples em Lua
✅ Usado por: AWS, Cloudflare, Stripe

Sliding Window:
❌ Mais complexo de implementar atomicamente
❌ Não permite bursts
✅ Mais preciso matematicamente
```

**Decisão:** Token Bucket com Lazy Refill (otimização)

---

### **2. Lua Script (Atomicidade)**

**Por que LUA e não código JavaScript?**

```
LUA Script (Redis):
✅ Execução ATÔMICA no servidor
✅ Zero race conditions
✅ Performance máxima (1 round-trip)

JavaScript (cliente):
❌ Múltiplas operações Redis = race condition
❌ Vários round-trips = latência
❌ Impossível garantir atomicidade
```

**Decisão:** Toda lógica Token Bucket em Lua

---

### **3. Fail-Open Strategy**

**Por que permitir requisições quando Redis cai?**

```
FAIL-OPEN (permite):
✅ Disponibilidade do negócio mantida
✅ Rate limiter é proteção, não infraestrutura crítica
✅ Usado por: Netflix, AWS API Gateway

FAIL-CLOSED (bloqueia):
❌ Redis down = API inteira down
❌ Dependência crítica desnecessária
❌ Impacto no negócio
```

**Decisão:** Fail-Open com logs de auditoria

---

### **4. Identificação de Cliente**

**Prioridade:** API Key > User ID > IP Address

```
API Key:
✅ Mais seguro
✅ Não spoofável
✅ Rate limit por aplicação

User ID:
✅ Seguro (de JWT)
✅ Rate limit por usuário
❌ Requer autenticação

IP Address:
✅ Funciona sem auth
❌ Spoofável (mitigado)
❌ Problema com NAT/proxies
```

**Decisão:** Sistema flexível com anti-spoofing

---

## 🔄 Fluxo de Requisição

```
1. Requisição chega
   ├─> Middleware identifica cliente
   │   └─> Prioridade: API Key > User ID > IP
   │
2. Tenta conectar Redis
   ├─> ✅ Conectado
   │   ├─> Executa Lua script (atômico)
   │   ├─> Calcula fichas (lazy refill)
   │   ├─> Tenta consumir ficha
   │   │   ├─> ✅ Tem fichas: ALLOW
   │   │   └─> ❌ Sem fichas: 429
   │   └─> Adiciona headers RFC
   │
   └─> ❌ Falha (erro/timeout)
       └─> FAIL-OPEN: ALLOW + log crítico
```

---

## 🧮 Token Bucket - Matemática

### **Fórmula Lazy Refill**

```javascript
tempo_passado = agora - ultima_recarga
fichas_geradas = tempo_passado × taxa_recarga

fichas_atuais = min(capacidade, fichas_antigas + fichas_geradas)

if (fichas_atuais >= custo) {
  PERMITIR
  fichas_atuais -= custo
} else {
  BLOQUEAR
  proximo_ficha_em = (custo - fichas_atuais) / taxa_recarga
}
```

### **Exemplo Prático**

```
Configuração:
- Capacidade: 100 fichas
- Recarga: 10 fichas/segundo
- Custo: 1 ficha/requisição

Cenário:
T=0s  → Usuário novo → 100 fichas
T=0s  → Requisição #1 → Consome 1 → 99 fichas
T=0s  → Requisição #2 → Consome 1 → 98 fichas
...
T=0s  → Requisição #100 → Consome 1 → 0 fichas
T=0s  → Requisição #101 → SEM FICHAS → 429 (retry em 0.1s)

T=5s  → Requisição #102 → Recarga 5s × 10 = 50 fichas → ALLOW
```

---

## 🗄️ Estrutura Redis

### **Formato das Chaves**

```
shield:apikey:abc123      → API Key
shield:user:user_456      → User ID
shield:ip:192.168.1.100   → IP Address
```

### **Dados Armazenados (Hash)**

```redis
HMSET shield:user:123
  tokens "87.5"
  last_refill "1701800000"
```

### **TTL (Auto-Cleanup)**

```
24 horas sem uso → Redis apaga automaticamente
Economiza memória
Não precisa job de limpeza
```

---

## 🔒 Segurança

### **1. Anti-Spoofing de IP**

```javascript
X-Forwarded-For: malicious_ip, real_proxy

// ❌ Usar último IP = bypass fácil
// ✅ Usar primeiro IP = cliente real

// Validação adicional:
- Formato válido IPv4/IPv6
- Não aceitar "unknown"
- Sanitizar ::ffff: prefix
```

### **2. Fail-Open Consciente**

```javascript
try {
  // Tenta rate limit
} catch (error) {
  logger.error({ critical: true });
  
  // ⚠️ PERMITE requisição
  // Melhor do que derrubar o sistema
  // Mas LOGA pra investigação
}
```

### **3. Timeout Configurado**

```
Redis timeout: 2 segundos máximo
Não pendura requisição
Fail-open se demorar
```

---

## 📊 Observabilidade

### **Logs Estruturados**

```json
{
  "timestamp": "2025-12-05T19:00:00.000Z",
  "level": "WARN",
  "event_type": "rate_limit_blocked",
  "client_id": "user:123",
  "action": "DENY",
  "remaining_tokens": 0
}
```

### **Headers de Resposta**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1701800000
Retry-After: 3
```

---

## 🎯 Requisitos Implementados

### **P0 - CRITICAL** ✅

- [x] **INFRA-001**: Conexão resiliente Redis
- [x] **CORE-001**: Token Bucket via Lua

### **P1 - REQUIRED** ✅

- [x] **SEC-001**: Fail-Open strategy
- [x] **API-001**: Headers RFC-compliant
- [x] **SEC-002**: Identificação segura (anti-spoofing)

### **P2 - ENHANCEMENT** ✅

- [x] **OPS-001**: Logs de auditoria JSON

---

## 🚀 Performance

### **Latência**

```
Redis local: ~1-2ms
Redis Upstash: ~10-50ms (dependendo região)
Timeout máximo: 2000ms (configurável)
```

### **Throughput**

```
Redis suporta: ~100k ops/s
Lua script: 1 operação = 1 decisão
Sem gargalo no rate limiter
```

---

## 📚 Referências

- [Token Bucket - Wikipedia](https://en.wikipedia.org/wiki/Token_bucket)
- [RFC 6585 - 429 Status Code](https://tools.ietf.org/html/rfc6585)
- [Redis Lua Scripting](https://redis.io/docs/manual/programmability/eval-intro/)
- [IETF Draft - RateLimit Headers](https://datatracker.ietf.org/doc/html/draft-polli-ratelimit-headers)

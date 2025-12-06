-- ================================================================
-- ATLAS RATE LIMITER - TOKEN BUCKET ALGORITHM (LUA SCRIPT)
-- ================================================================
-- ARCH-001: Usa Redis TIME ao invés de Date.now() do Node.js
-- Previne inconsistências por clock drift entre servidores
-- ================================================================

-- KEYS[1] = Hash key do cliente (ex: "ratelimit:user_123")
-- ARGV[1] = Capacidade máxima do balde
-- ARGV[2] = Taxa de recarga (fichas por segundo)
-- ARGV[3] = Custo da requisição (geralmente 1)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])

-- ================================================================
-- ARCH-001: OBTER TIMESTAMP DO REDIS (fonte única de verdade)
-- ================================================================
-- redis.call('TIME') retorna: { segundos, microssegundos }
-- Todos os servidores usam o mesmo relógio (Redis server)
local time_result = redis.call('TIME')
local now = tonumber(time_result[1])  -- Segundos desde epoch
local now_us = tonumber(time_result[2])  -- Microssegundos

-- Buscar estado atual do balde
local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

-- Primeira requisição deste cliente (balde não existe)
if tokens == nil then
  tokens = capacity
  last_refill = now
end

-- ================================================================
-- LAZY REFILL - Calcular fichas geradas desde última requisição
-- ================================================================
local time_passed = math.max(0, now - last_refill)
local tokens_to_add = time_passed * refill_rate

-- Adicionar fichas respeitando capacidade máxima
tokens = math.min(capacity, tokens + tokens_to_add)

-- Atualizar timestamp de última recarga
last_refill = now

-- ================================================================
-- CONSUMIR FICHA
-- ================================================================
local allowed = 0
local remaining = tokens

if tokens >= cost then
  -- TEM FICHAS - PERMITE REQUISIÇÃO
  tokens = tokens - cost
  allowed = 1
  remaining = tokens
  
  -- Atualizar estado no Redis
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
  
  -- IMP-003: TTL dinâmico otimizado
  -- Se usuário tem muitas fichas (>50%), é provavelmente legítimo → TTL maior (2h)
  -- Se usuário tem poucas fichas, pode ser ataque → TTL menor (1h)
  local ttl = tokens > capacity * 0.5 and 7200 or 3600
  redis.call('EXPIRE', key, ttl)
else
  -- SEM FICHAS - BLOQUEIA
  allowed = 0
  remaining = tokens  -- Mostrar fichas reais (não 0)
  
  -- BUG FIX: Atualizar last_refill mesmo quando bloqueado
  -- Previne acúmulo de fichas durante período de bloqueio
  redis.call('HSET', key, 'last_refill', last_refill)
  
  -- IMP-003: Atacantes bloqueados expiram em 1h (não lotam Redis)
  redis.call('EXPIRE', key, 3600)
end

-- ================================================================
-- CALCULAR QUANDO TERÁ PRÓXIMA FICHA (para Retry-After header)
-- ================================================================
local time_until_refill = 0
if allowed == 0 then
  time_until_refill = math.ceil((cost - tokens) / refill_rate)
end

-- ================================================================
-- RETORNAR RESULTADO
-- ================================================================
-- Formato: { allowed, remaining, reset_timestamp }
return {
  allowed,
  math.floor(remaining),
  now + time_until_refill
}

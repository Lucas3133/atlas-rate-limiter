-- ================================================================
-- ATLAS RATE LIMITER - TOKEN BUCKET ALGORITHM (LUA SCRIPT)
-- ================================================================
-- ARCH-001: Uses Redis TIME instead of Date.now() from Node.js
-- Prevents inconsistencies from clock drift between servers
-- ================================================================

-- KEYS[1] = Client hash key (e.g., "ratelimit:user_123")
-- ARGV[1] = Maximum bucket capacity
-- ARGV[2] = Refill rate (tokens per second)
-- ARGV[3] = Request cost (usually 1)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])

-- ================================================================
-- ARCH-001: GET TIMESTAMP FROM REDIS (single source of truth)
-- ================================================================
-- redis.call('TIME') returns: { seconds, microseconds }
-- All servers use the same clock (Redis server)
local time_result = redis.call('TIME')
local now = tonumber(time_result[1])  -- Seconds since epoch
local now_us = tonumber(time_result[2])  -- Microseconds

-- Fetch current bucket state
local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

-- First request from this client (bucket doesn't exist)
if tokens == nil then
  tokens = capacity
  last_refill = now
end

-- ================================================================
-- LAZY REFILL - Calculate tokens generated since last request
-- ================================================================
local time_passed = math.max(0, now - last_refill)
local tokens_to_add = time_passed * refill_rate

-- Add tokens respecting maximum capacity
tokens = math.min(capacity, tokens + tokens_to_add)

-- Update last refill timestamp
last_refill = now

-- ================================================================
-- CONSUME TOKEN
-- ================================================================
local allowed = 0
local remaining = tokens

if tokens >= cost then
  -- HAS TOKENS - ALLOW REQUEST
  tokens = tokens - cost
  allowed = 1
  remaining = tokens
  
  -- Update state in Redis
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
  
  -- IMP-003: Optimized dynamic TTL
  -- If user has many tokens (>50%), likely legitimate → longer TTL (2h)
  -- If user has few tokens, may be attack → shorter TTL (1h)
  local ttl = tokens > capacity * 0.5 and 7200 or 3600
  redis.call('EXPIRE', key, ttl)
else
  -- NO TOKENS - BLOCK
  allowed = 0
  remaining = tokens  -- Show actual tokens (not 0)
  
  -- BUG FIX: Update last_refill even when blocked
  -- Prevents token accumulation during blocking period
  redis.call('HSET', key, 'last_refill', last_refill)
  
  -- IMP-003: Blocked attackers expire in 1h (don't fill up Redis)
  redis.call('EXPIRE', key, 3600)
end

-- ================================================================
-- CALCULATE WHEN NEXT TOKEN WILL BE AVAILABLE (for Retry-After header)
-- ================================================================
local time_until_refill = 0
if allowed == 0 then
  time_until_refill = math.ceil((cost - tokens) / refill_rate)
end

-- ================================================================
-- RETURN RESULT
-- ================================================================
-- Format: { allowed, remaining, reset_timestamp }
return {
  allowed,
  math.floor(remaining),
  now + time_until_refill
}

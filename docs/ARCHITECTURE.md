# 🏗️ Atlas Rate Limiter - Technical Architecture

## 📋 Original Documentation

This implementation faithfully follows the provided technical specification, implementing all P0 and P1 requirements.

## 🎯 Architectural Decisions

### **1. Token Bucket Algorithm**

**Why Token Bucket instead of Sliding Window?**

```
Token Bucket:
✅ Allows controlled bursts
✅ More fair (continuous refill)
✅ Simple atomic implementation in Lua
✅ Used by: AWS, Cloudflare, Stripe

Sliding Window:
❌ More complex to implement atomically
❌ Doesn't allow bursts
✅ More mathematically precise
```

**Decision:** Token Bucket with Lazy Refill (optimization)

---

### **2. Lua Script (Atomicity)**

**Why LUA instead of JavaScript code?**

```
LUA Script (Redis):
✅ ATOMIC execution on server
✅ Zero race conditions
✅ Maximum performance (1 round-trip)

JavaScript (client):
❌ Multiple Redis operations = race condition
❌ Multiple round-trips = latency
❌ Impossible to guarantee atomicity
```

**Decision:** All Token Bucket logic in Lua

---

### **3. Fail-Open Strategy**

**Why allow requests when Redis is down?**

```
FAIL-OPEN (allows):
✅ Business availability maintained
✅ Rate limiter is protection, not critical infrastructure
✅ Used by: Netflix, AWS API Gateway

FAIL-CLOSED (blocks):
❌ Redis down = entire API down
❌ Unnecessary critical dependency
❌ Business impact
```

**Decision:** Fail-Open with audit logs

---

### **4. Client Identification**

**Priority:** API Key > User ID > IP Address

```
API Key:
✅ Most secure
✅ Not spoofable
✅ Rate limit per application

User ID:
✅ Secure (from JWT)
✅ Rate limit per user
❌ Requires authentication

IP Address:
✅ Works without auth
❌ Spoofable (mitigated)
❌ Problem with NAT/proxies
```

**Decision:** Flexible system with anti-spoofing

---

## 🔄 Request Flow

```
1. Request arrives
   ├─> Middleware identifies client
   │   └─> Priority: API Key > User ID > IP
   │
2. Try to connect Redis
   ├─> ✅ Connected
   │   ├─> Execute Lua script (atomic)
   │   ├─> Calculate tokens (lazy refill)
   │   ├─> Try to consume token
   │   │   ├─> ✅ Has tokens: ALLOW
   │   │   └─> ❌ No tokens: 429
   │   └─> Add RFC headers
   │
   └─> ❌ Failure (error/timeout)
       └─> FAIL-OPEN: ALLOW + critical log
```

---

## 🧮 Token Bucket - Mathematics

### **Lazy Refill Formula**

```javascript
time_passed = now - last_refill
tokens_generated = time_passed × refill_rate

current_tokens = min(capacity, old_tokens + tokens_generated)

if (current_tokens >= cost) {
  ALLOW
  current_tokens -= cost
} else {
  BLOCK
  next_token_in = (cost - current_tokens) / refill_rate
}
```

### **Practical Example**

```
Configuration:
- Capacity: 100 tokens
- Refill: 10 tokens/second
- Cost: 1 token/request

Scenario:
T=0s  → New user → 100 tokens
T=0s  → Request #1 → Consumes 1 → 99 tokens
T=0s  → Request #2 → Consumes 1 → 98 tokens
...
T=0s  → Request #100 → Consumes 1 → 0 tokens
T=0s  → Request #101 → NO TOKENS → 429 (retry in 0.1s)

T=5s  → Request #102 → Refill 5s × 10 = 50 tokens → ALLOW
```

---

## 🗄️ Redis Structure

### **Key Format**

```
shield:apikey:abc123      → API Key
shield:user:user_456      → User ID
shield:ip:192.168.1.100   → IP Address
```

### **Stored Data (Hash)**

```redis
HMSET shield:user:123
  tokens "87.5"
  last_refill "1701800000"
```

### **TTL (Auto-Cleanup)**

```
24 hours without use → Redis auto-deletes
Saves memory
No cleanup job needed
```

---

## 🔒 Security

### **1. IP Anti-Spoofing**

```javascript
X-Forwarded-For: malicious_ip, real_proxy

// ❌ Using last IP = easy bypass
// ✅ Using first IP = real client

// Additional validation:
- Valid IPv4/IPv6 format
- Don't accept "unknown"
- Sanitize ::ffff: prefix
```

### **2. Conscious Fail-Open**

```javascript
try {
  // Try rate limit
} catch (error) {
  logger.error({ critical: true });
  
  // ⚠️ ALLOWS request
  // Better than bringing down the system
  // But LOGS for investigation
}
```

### **3. Configured Timeout**

```
Redis timeout: 2 seconds max
Doesn't hang request
Fail-open if too slow
```

---

## 📊 Observability

### **Structured Logs**

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

### **Response Headers**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1701800000
Retry-After: 3
```

---

## 🎯 Implemented Requirements

### **P0 - CRITICAL** ✅

- [x] **INFRA-001**: Resilient Redis connection
- [x] **CORE-001**: Token Bucket via Lua

### **P1 - REQUIRED** ✅

- [x] **SEC-001**: Fail-Open strategy
- [x] **API-001**: RFC-compliant headers
- [x] **SEC-002**: Secure identification (anti-spoofing)

### **P2 - ENHANCEMENT** ✅

- [x] **OPS-001**: JSON audit logs

---

## 🚀 Performance

### **Latency**

```
Local Redis: ~1-2ms
Upstash Redis: ~10-50ms (depending on region)
Max timeout: 2000ms (configurable)
```

### **Throughput**

```
Redis supports: ~100k ops/s
Lua script: 1 operation = 1 decision
No bottleneck in rate limiter
```

---

## 📚 References

- [Token Bucket - Wikipedia](https://en.wikipedia.org/wiki/Token_bucket)
- [RFC 6585 - 429 Status Code](https://tools.ietf.org/html/rfc6585)
- [Redis Lua Scripting](https://redis.io/docs/manual/programmability/eval-intro/)
- [IETF Draft - RateLimit Headers](https://datatracker.ietf.org/doc/html/draft-polli-ratelimit-headers)

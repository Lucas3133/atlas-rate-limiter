// ================================================================
// ATLAS RATE LIMITER - EXPRESS MIDDLEWARE
// ================================================================
// Integration of all components
// ================================================================

const fs = require('fs');
const path = require('path');
const { getRedisClient } = require('../core/redisClient');
const { identifyClient } = require('../utils/clientIdentifier');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics'); // FEAT-001
const config = require('../config');

// PERF-001: Lua script loaded once (EVALSHA optimizes bandwidth)
const luaScriptPath = path.join(__dirname, '../core/tokenBucket.lua');
const luaScript = fs.readFileSync(luaScriptPath, 'utf8');
let isScriptDefined = false;

/**
 * Rate Limiting Middleware
 * 
 * @param {object} options - Optional configurations
 * @param {number} options.capacity - Bucket capacity (override)
 * @param {number} options.refillRate - Refill rate (override)
 * @returns {Function} Express middleware
 */
function rateLimiter(options = {}) {
    const capacity = options.capacity || config.rateLimit.capacity;
    const refillRate = options.refillRate || config.rateLimit.refillRate;
    const cost = options.cost || config.rateLimit.cost;

    // ============================================================
    // FIX-003: STRICT INPUT VALIDATION
    // ============================================================
    // Prevents crashes in Lua script with invalid values

    if (typeof capacity !== 'number' || capacity <= 0 || !Number.isFinite(capacity)) {
        throw new Error(`[Atlas Shield] Invalid capacity: ${capacity}. Must be positive number.`);
    }

    if (typeof refillRate !== 'number' || refillRate <= 0 || !Number.isFinite(refillRate)) {
        throw new Error(`[Atlas Shield] Invalid refillRate: ${refillRate}. Must be positive number.`);
    }

    if (typeof cost !== 'number' || cost <= 0 || !Number.isFinite(cost)) {
        throw new Error(`[Atlas Shield] Invalid cost: ${cost}. Must be positive number.`);
    }

    // Additional validation: capacity must be >= cost
    if (capacity < cost) {
        throw new Error(`[Atlas Shield] Capacity (${capacity}) must be >= cost (${cost})`);
    }

    return async (req, res, next) => {
        const startTime = Date.now(); // FEAT-001: Measure latency
        try {
            // ============================================================
            // 1. IDENTIFY CLIENT
            // ============================================================
            const clientId = identifyClient(req);
            const redisKey = `${config.rateLimit.keyPrefix}${clientId}`;
            metrics.trackClient(clientId); // FEAT-001

            // ============================================================
            // 2. GET REDIS CLIENT
            // ============================================================
            const redis = getRedisClient();

            // SEC-001: FAIL-OPEN
            // If Redis unavailable, allow request
            if (!redis) {
                logger.warn({
                    event_type: 'rate_limit_fail_open',
                    client_id: clientId,
                    reason: 'Redis unavailable',
                    action: 'ALLOW'
                });
                metrics.incrementFailOpen(); // FEAT-001
                return next();
            }

            // ============================================================
            // PERF-001: DEFINE CUSTOM COMMAND (once)
            // ============================================================
            // defineCommand registers the script in Redis and uses EVALSHA
            // automatically. Saves bandwidth by sending only SHA instead
            // of the entire script on each request.

            if (!isScriptDefined) {
                redis.defineCommand('tokenBucket', {
                    numberOfKeys: 1,
                    lua: luaScript
                });
                isScriptDefined = true;
            }

            // ============================================================
            // 3. EXECUTE LUA SCRIPT (Atomic Token Bucket via EVALSHA)
            // ============================================================
            // ARCH-001: Timestamp now comes from Redis TIME (not Date.now anymore)
            // Prevents clock drift between multiple Node.js servers

            // PERF-001: Uses custom command (EVALSHA internally)
            const result = await redis.tokenBucket(
                redisKey, // KEY
                capacity, // ARGV[1]
                refillRate, // ARGV[2]
                cost // ARGV[3] (was ARGV[4], now removed timestamp)
            );

            const [allowed, remaining, resetTimestamp] = result;

            // ============================================================
            // 4. ADD RFC-COMPLIANT HEADERS (API-001)
            // ============================================================
            res.setHeader('X-RateLimit-Limit', capacity);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', resetTimestamp);

            // ============================================================
            // 5. DECISION: ALLOW or DENY
            // ============================================================
            if (allowed === 1) {
                // ✅ ALLOWED
                logger.auditAllow(clientId, remaining);
                metrics.incrementAllowed(); // FEAT-001
                metrics.recordResponseTime(Date.now() - startTime); // FEAT-001
                return next();
            } else {
                // ❌ BLOCKED - 429 Too Many Requests
                logger.auditBlock(clientId, remaining);
                metrics.incrementBlocked(); // FEAT-001
                metrics.recordResponseTime(Date.now() - startTime); // FEAT-001

                // ARCH-001: Calculate retry after using current timestamp
                const now = Math.floor(Date.now() / 1000);
                const retryAfter = Math.max(0, resetTimestamp - now);
                res.setHeader('Retry-After', retryAfter);

                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please slow down.',
                    retry_after_seconds: retryAfter,
                    limit: capacity,
                    remaining: 0,
                    reset: resetTimestamp
                });
            }

        } catch (error) {
            // ============================================================
            // SEC-001: FAIL-OPEN IN CASE OF ERROR
            // ============================================================
            metrics.incrementRedisError(); // FEAT-001
            logger.error({
                event_type: 'rate_limit_error',
                message: error.message,
                stack: config.env === 'development' ? error.stack : undefined,
                action: 'ALLOW (fail-open)'
            });

            // Allow request (availability > control)
            return next();
        }
    };
}

module.exports = rateLimiter;

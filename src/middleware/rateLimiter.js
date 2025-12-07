// ================================================================
// ATLAS RATE LIMITER - EXPRESS MIDDLEWARE
// ================================================================
// Integration of all components
// SEC-ADV-001: Smart malicious client detection
// ================================================================

const fs = require('fs');
const path = require('path');
const { getRedisClient } = require('../core/redisClient');
const { identifyClient } = require('../utils/clientIdentifier');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
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
        const startTime = Date.now();
        try {
            // ============================================================
            // 1. IDENTIFY CLIENT
            // ============================================================
            const clientId = identifyClient(req);
            const redisKey = `${config.rateLimit.keyPrefix}${clientId}`;
            metrics.trackClient(clientId);

            // ============================================================
            // SEC-ADV-001: Check if client is already flagged as malicious
            // ============================================================
            const isKnownMalicious = metrics.isMaliciousClient(clientId);

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
                metrics.incrementFailOpen();
                return next();
            }

            // ============================================================
            // PERF-001: DEFINE CUSTOM COMMAND (once)
            // ============================================================
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
            const result = await redis.tokenBucket(
                redisKey,
                capacity,
                refillRate,
                cost
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
                metrics.incrementAllowed();
                metrics.recordResponseTime(Date.now() - startTime);
                return next();
            } else {
                // ❌ BLOCKED - 429 Too Many Requests

                // SEC-ADV-001: Track violation and detect malicious behavior
                const isMalicious = isKnownMalicious || metrics.trackViolation(clientId);

                // Log with malicious flag
                logger.auditBlock(clientId, remaining, isMalicious);

                // Update metrics with malicious distinction
                metrics.incrementBlocked(clientId, isMalicious);
                metrics.recordResponseTime(Date.now() - startTime);

                // Calculate retry after
                const now = Math.floor(Date.now() / 1000);
                const retryAfter = Math.max(0, resetTimestamp - now);
                res.setHeader('Retry-After', retryAfter);

                // SEC-ADV-001: Add threat indicator header for monitoring
                if (isMalicious) {
                    res.setHeader('X-Threat-Level', 'MALICIOUS');
                }

                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: isMalicious
                        ? 'Rate limit exceeded. Your activity has been flagged as suspicious.'
                        : 'Rate limit exceeded. Please slow down.',
                    retry_after_seconds: retryAfter,
                    limit: capacity,
                    remaining: 0,
                    reset: resetTimestamp,
                    threat_detected: isMalicious
                });
            }

        } catch (error) {
            // ============================================================
            // SEC-001: FAIL-OPEN IN CASE OF ERROR
            // ============================================================
            metrics.incrementRedisError();
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

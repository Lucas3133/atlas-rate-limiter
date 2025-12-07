// ================================================================
// ATLAS RATE LIMITER - EXPRESS MIDDLEWARE
// ================================================================
// Integration of all components
// SEC-ADV-001: Smart malicious client detection
// SEC-ADV-002: Immediate blocking for banned clients
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
    if (typeof capacity !== 'number' || capacity <= 0 || !Number.isFinite(capacity)) {
        throw new Error(`[Atlas Shield] Invalid capacity: ${capacity}. Must be positive number.`);
    }

    if (typeof refillRate !== 'number' || refillRate <= 0 || !Number.isFinite(refillRate)) {
        throw new Error(`[Atlas Shield] Invalid refillRate: ${refillRate}. Must be positive number.`);
    }

    if (typeof cost !== 'number' || cost <= 0 || !Number.isFinite(cost)) {
        throw new Error(`[Atlas Shield] Invalid cost: ${cost}. Must be positive number.`);
    }

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
            metrics.trackClient(clientId);

            // ============================================================
            // SEC-ADV-002: CHECK IF CLIENT IS BANNED (IMMEDIATE BLOCK!)
            // ============================================================
            // This happens BEFORE checking Redis or tokens!
            // Banned clients are blocked instantly - no token refill allowed

            if (metrics.isClientBanned(clientId)) {
                const banTimeRemaining = metrics.getBanTimeRemaining(clientId);

                // Log the banned request
                logger.auditBlock(clientId, 0, true);
                metrics.incrementBlocked(clientId, true);
                metrics.recordResponseTime(Date.now() - startTime);

                // Set headers
                res.setHeader('X-RateLimit-Limit', capacity);
                res.setHeader('X-RateLimit-Remaining', 0);
                res.setHeader('Retry-After', banTimeRemaining);
                res.setHeader('X-Ban-Remaining', banTimeRemaining);
                res.setHeader('X-Threat-Level', 'BANNED');

                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: 'Your IP has been temporarily banned due to excessive requests.',
                    banned: true,
                    ban_remaining_seconds: banTimeRemaining,
                    retry_after_seconds: banTimeRemaining,
                    limit: capacity,
                    remaining: 0
                });
            }

            // ============================================================
            // 2. GET REDIS CLIENT
            // ============================================================
            const redisKey = `${config.rateLimit.keyPrefix}${clientId}`;
            const redis = getRedisClient();

            // SEC-001: FAIL-OPEN
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
            // 3. EXECUTE LUA SCRIPT (Atomic Token Bucket)
            // ============================================================
            const result = await redis.tokenBucket(
                redisKey,
                capacity,
                refillRate,
                cost
            );

            const [allowed, remaining, resetTimestamp] = result;

            // ============================================================
            // 4. ADD RFC-COMPLIANT HEADERS
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

                // SEC-ADV-001: Track violation and check if should be banned
                const shouldBan = metrics.trackViolation(clientId);
                const isBanned = shouldBan || metrics.isClientBanned(clientId);

                // Log with malicious flag
                logger.auditBlock(clientId, remaining, isBanned);

                // Update metrics
                metrics.incrementBlocked(clientId, isBanned);
                metrics.recordResponseTime(Date.now() - startTime);

                // Calculate retry after
                const now = Math.floor(Date.now() / 1000);
                let retryAfter = Math.max(0, resetTimestamp - now);

                // SEC-ADV-002: If just got banned, use ban time instead
                if (shouldBan) {
                    retryAfter = metrics.getBanTimeRemaining(clientId);
                    res.setHeader('X-Ban-Remaining', retryAfter);
                }

                res.setHeader('Retry-After', retryAfter);

                if (isBanned) {
                    res.setHeader('X-Threat-Level', 'BANNED');
                }

                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: isBanned
                        ? 'Your IP has been temporarily banned due to excessive requests.'
                        : 'Rate limit exceeded. Please slow down.',
                    banned: isBanned,
                    retry_after_seconds: retryAfter,
                    limit: capacity,
                    remaining: 0,
                    reset: resetTimestamp,
                    threat_detected: isBanned
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

            return next();
        }
    };
}

module.exports = rateLimiter;

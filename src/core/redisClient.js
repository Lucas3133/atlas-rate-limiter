// ================================================================
// ATLAS RATE LIMITER - RESILIENT REDIS CONNECTION
// ================================================================
// INFRA-001: TCP/TLS connection with Upstash using ioredis
// ================================================================

const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Creates resilient Redis connection (Upstash)
 * - Configured timeout (doesn't hang the API)
 * - Silent error handling (Fail-Open)
 * - Automatic reconnect
 */
function createRedisClient() {
    if (redisClient) {
        return redisClient;
    }

    try {
        redisClient = new Redis(config.redis.url, {
            // ============================================================
            // RESILIENCE
            // ============================================================
            connectTimeout: config.redis.timeoutMs,
            commandTimeout: config.redis.timeoutMs,

            // BUG-003 FIX: Improved retry strategy
            // Before: gave up after 3 attempts (6s)
            // Now: tries up to 60x with backoff up to 10s
            // Scenario: If Redis is down for 1-2min, can reconnect automatically
            retryStrategy: (times) => {
                if (times > 60) {
                    logger.error({
                        event_type: 'redis_connection_failed',
                        message: 'Redis giving up reconnection after 60 attempts (~10 minutes)'
                    });
                    return null; // Stop trying
                }
                // Exponential backoff with 10s limit
                return Math.min(times * 1000, 10000);
            },

            // ============================================================
            // SECURITY
            // ============================================================
            tls: config.redis.url.startsWith('rediss://') ? {} : undefined,

            // ============================================================
            // PERFORMANCE
            // ============================================================
            enableReadyCheck: false,
            maxRetriesPerRequest: 1,
            lazyConnect: false, // Connect immediately
        });

        // ============================================================
        // EVENT LISTENERS (Observability)
        // ============================================================

        redisClient.on('connect', () => {
            console.log('\n✅ ========================================');
            console.log('✅ REDIS CONNECTED SUCCESSFULLY!');
            console.log('✅ Rate limiting ACTIVE!');
            console.log('✅ ========================================\n');

            logger.info({
                event_type: 'redis_connected',
                message: 'Connection established with Redis (Upstash)'
            });
        });

        redisClient.on('error', (err) => {
            console.log('\n❌ ========================================');
            console.log('❌ REDIS CONNECTION ERROR!');
            console.log('❌ Reason:', err.message);
            console.log('❌ System running in FAIL-OPEN mode');
            console.log('❌ (Requests allowed without rate limit)');
            console.log('❌ ========================================\n');

            logger.error({
                event_type: 'redis_error',
                message: err.message,
                stack: config.env === 'development' ? err.stack : undefined
            });
        });

        redisClient.on('close', () => {
            logger.warn({
                event_type: 'redis_connection_closed',
                message: 'Redis connection was closed'
            });
        });

        return redisClient;

    } catch (error) {
        logger.error({
            event_type: 'redis_initialization_error',
            message: error.message
        });

        // Return null - Fail-Open will allow requests
        return null;
    }
}

/**
 * Tests if Redis connection is healthy
 */
async function healthCheck() {
    try {
        const client = getRedisClient();
        if (!client) return false;

        const result = await client.ping();
        return result === 'PONG';
    } catch (error) {
        return false;
    }
}

/**
 * Returns Redis client (singleton)
 */
function getRedisClient() {
    if (!redisClient) {
        return createRedisClient();
    }
    return redisClient;
}

/**
 * Closes connection (for tests/graceful shutdown)
 */
async function closeRedisConnection() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}

module.exports = {
    getRedisClient,
    healthCheck,
    closeRedisConnection
};

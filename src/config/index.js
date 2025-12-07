// ================================================================
// ATLAS RATE LIMITER - CENTRALIZED CONFIGURATION
// ================================================================

require('dotenv').config();

const config = {
    // ============================================================
    // ENVIRONMENT
    // ============================================================
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),

    // ============================================================
    // REDIS (Upstash)
    // ============================================================
    redis: {
        url: process.env.UPSTASH_REDIS_URL,
        timeoutMs: parseInt(process.env.REDIS_TIMEOUT_MS || '2000', 10),
    },

    // ============================================================
    // RATE LIMITER - TOKEN BUCKET
    // ============================================================
    rateLimit: {
        // Maximum bucket capacity (tokens)
        capacity: parseInt(process.env.RATE_LIMIT_CAPACITY || '100', 10),

        // Refill rate (tokens per second)
        // FIX-001: Default changed from 10 to 1 to prevent continuous attacks
        refillRate: parseInt(process.env.RATE_LIMIT_REFILL_RATE || '1', 10),

        // Cost per request (usually 1)
        cost: 1,

        // Redis key prefix
        keyPrefix: 'shield:',
    },

    // ============================================================
    // SECURITY
    // ============================================================
    security: {
        // FIX-002: Configurable Trust Proxy via .env
        // Values: false, true, 1, 2, 'loopback', 'linklocal', 'uniquelocal'
        // - false: Trust no proxy (local dev)
        // - 1: First proxy (Railway, Render, Vercel)
        // - true: Any proxy (Cloudflare)
        trustProxy: process.env.TRUST_PROXY === 'true'
            ? true
            : process.env.TRUST_PROXY === 'false'
                ? false
                : parseInt(process.env.TRUST_PROXY || '0', 10) || false,

        // Trusted headers for IP (when behind proxy)
        trustedProxyHeaders: ['x-forwarded-for', 'x-real-ip'],

        // Identification priority
        // 1. API Key (most secure)
        // 2. User ID (from JWT/session)
        // 3. IP Address (least secure, but works)
        identificationStrategy: 'api-key-first',
    }
};

// ============================================================
// VALIDATION
// ============================================================
function validateConfig() {
    const errors = [];

    if (!config.redis.url) {
        errors.push('UPSTASH_REDIS_URL not configured in .env');
    }

    if (config.rateLimit.capacity < 1) {
        errors.push('RATE_LIMIT_CAPACITY must be >= 1');
    }

    if (config.rateLimit.refillRate < 1) {
        errors.push('RATE_LIMIT_REFILL_RATE must be >= 1');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
    }
}

// Validate on load
validateConfig();

module.exports = config;

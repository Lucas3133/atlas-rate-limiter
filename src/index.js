// ================================================================
// ATLAS RATE LIMITER - DEMO API
// ================================================================

const express = require('express');
const rateLimiter = require('./middleware/rateLimiter');
const { healthCheck } = require('./core/redisClient');
const config = require('./config');
const logger = require('./utils/logger');

// ============================================================
// IMP-001: RATE LIMIT CONSTANTS (avoids magic numbers)
// ============================================================
const RATE_LIMITS = {
    LOGIN: { capacity: 5, refillRate: 1 },        // Login: 5 attempts/5s
    ADMIN: { capacity: 1000, refillRate: 100 },   // Admin: 1000 req/10s
    METRICS: { capacity: 50, refillRate: 5 },     // Metrics: 50 req/10s
    STATIC: { capacity: 500, refillRate: 50 },    // Static: 500 req/10s
    PUBLIC: null                                   // Public: uses default config
};

const app = express();

// FIX-002: Configurable Trust Proxy via TRUST_PROXY in .env
app.set('trust proxy', config.security.trustProxy);

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(express.json());

// ============================================================
// BUG-004 FIX: STATIC FILE PROTECTION
// ============================================================
// Before: files in /public without protection (vulnerable to DDoS)
// Now: generous rate limit (500 req/50s = 10 req/s)
// Doesn't affect normal users, but prevents volumetric attacks
// ============================================================
app.use('/public', rateLimiter(RATE_LIMITS.STATIC));
app.use(express.static('public'));

// ============================================================
// IMP-002: Structured logger for ALL requests
// ============================================================
app.use((req, res, next) => {
    logger.debug({
        event_type: 'http_request',
        method: req.method,
        path: req.path,
        ip: req.ip
    });
    next();
});

// ============================================================
// ROUTES
// ============================================================

// Health check (no rate limit)
app.get('/health', async (req, res) => {
    const redisHealthy = await healthCheck();

    res.json({
        status: 'ok',
        services: {
            api: 'healthy',
            redis: redisHealthy ? 'healthy' : 'degraded'
        },
        timestamp: new Date().toISOString()
    });
});

// FEAT-001: Prometheus Metrics (BUG-001 FIX: WITH rate limit to prevent DDoS)
app.get('/metrics', rateLimiter(RATE_LIMITS.METRICS), (req, res) => {
    const metrics = require('./utils/metrics');
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics.toPrometheus());
});


// Public route (WITH default rate limit)
app.get('/api/public', rateLimiter(), (req, res) => {
    res.json({
        message: 'Public route with default rate limit',
        timestamp: new Date().toISOString()
    });
});

// Login route (RESTRICTIVE rate limit)
app.post('/api/login', rateLimiter(RATE_LIMITS.LOGIN), (req, res) => {
    res.json({
        message: 'Simulated login (5 attempts per 5 seconds)',
        note: 'In production, this would verify credentials'
    });
});

// Login TEST route (GET for easy browser testing!)
app.get('/api/login-test', rateLimiter(RATE_LIMITS.LOGIN), (req, res) => {
    res.json({
        message: '🧪 Rate Limit Test - Login',
        limit: '5 requests per 5 seconds',
        tip: 'Press F5 about 10x FAST to see blocking!',
        timestamp: new Date().toISOString()
    });
});

// Admin route (PERMISSIVE rate limit)
app.get('/api/admin', rateLimiter(RATE_LIMITS.ADMIN), (req, res) => {
    res.json({
        message: 'Admin route with high rate limit',
        timestamp: new Date().toISOString()
    });
});

// BUG-002 FIX: Route WITHOUT rate limit (DEVELOPMENT ONLY)
// ⚠️ SECURITY: This route only exists in dev for testing
// In production, it would bypass all rate limiter protection
if (config.env === 'development') {
    app.get('/api/no-limit', (req, res) => {
        res.json({
            message: 'This route has NO rate limit applied',
            warning: 'Available ONLY in development environment',
            environment: config.env
        });
    });
}

// 404 route
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path
    });
});

// ============================================================
// INITIALIZATION
// ============================================================
app.listen(config.port, () => {
    logger.info({
        event_type: 'server_started',
        message: `🛡️ Atlas Rate Limiter running!`,
        port: config.port,
        environment: config.env
    });

    console.log('');
    console.log('========================================');
    console.log('🛡️  ATLAS RATE LIMITER (SHIELD)');
    console.log('========================================');
    console.log(`📍 URL: http://localhost:${config.port}`);
    console.log(`🌍 Environment: ${config.env}`);
    console.log(`🔒 Trust Proxy: ${config.security.trustProxy}`);
    console.log(`⚡ Token Bucket: ${config.rateLimit.capacity} tokens @ ${config.rateLimit.refillRate}/s`);
    console.log('========================================');
    console.log('');
    console.log('📡 Available Endpoints:');
    console.log('  GET    /health              (Health check)');
    console.log('  GET    /metrics             (Prometheus metrics)');
    console.log('  GET    /api/public          (Rate limit: 100 req/10s)');
    console.log('  POST   /api/login           (Rate limit: 5 req/5s)');
    console.log('  GET    /api/admin           (Rate limit: 1000 req/10s)');
    console.log('  GET    /api/no-limit        (No rate limit)');
    console.log('========================================');
    console.log('');
});

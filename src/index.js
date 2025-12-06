// ================================================================
// ATLAS RATE LIMITER - API DE DEMONSTRAÇÃO
// ================================================================

const express = require('express');
const rateLimiter = require('./middleware/rateLimiter');
const { healthCheck } = require('./core/redisClient');
const config = require('./config');
const logger = require('./utils/logger');

// ============================================================
// IMP-001: CONSTANTES DE RATE LIMIT (evita magic numbers)
// ============================================================
const RATE_LIMITS = {
    LOGIN: { capacity: 5, refillRate: 1 },        // Login: 5 tentativas/5s
    ADMIN: { capacity: 1000, refillRate: 100 },   // Admin: 1000 req/10s
    METRICS: { capacity: 50, refillRate: 5 },     // Metrics: 50 req/10s
    STATIC: { capacity: 500, refillRate: 50 },    // Static: 500 req/10s
    PUBLIC: null                                   // Public: usa padrão do config
};

const app = express();

// FIX-002: Trust Proxy configurável via TRUST_PROXY no .env
app.set('trust proxy', config.security.trustProxy);

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(express.json());

// ============================================================
// BUG-004 FIX: PROTEÇÃO DE ARQUIVOS ESTÁTICOS
// ============================================================
// Antes: arquivos em /public sem proteção (vulnerável a DDoS)
// Agora: rate limit generoso (500 req/50s = 10 req/s)
// Não afeta usuários normais, mas previne ataques volumétricos
// ============================================================
app.use('/public', rateLimiter(RATE_LIMITS.STATIC));
app.use(express.static('public'));

// ============================================================
// IMP-002: Logger estruturado de TODAS as requisições
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
// ROTAS
// ============================================================

// Health check (sem rate limit)
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

// FEAT-001: Prometheus Metrics (BUG-001 FIX: COM rate limit para prevenir DDoS)
app.get('/metrics', rateLimiter(RATE_LIMITS.METRICS), (req, res) => {
    const metrics = require('./utils/metrics');
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics.toPrometheus());
});


// Rota pública (COM rate limit padrão)
app.get('/api/public', rateLimiter(), (req, res) => {
    res.json({
        message: 'Rota pública com rate limit padrão',
        timestamp: new Date().toISOString()
    });
});

// Rota de login (rate limit RESTRITIVO)
app.post('/api/login', rateLimiter(RATE_LIMITS.LOGIN), (req, res) => {
    res.json({
        message: 'Login simulado (5 tentativas por 5 segundos)',
        note: 'Em produção, aqui verificaria credenciais'
    });
});

// Rota de TESTE de login (GET pra testar fácil no navegador!)
app.get('/api/login-test', rateLimiter(RATE_LIMITS.LOGIN), (req, res) => {
    res.json({
        message: '🧪 Teste de Rate Limit - Login',
        limit: '5 requisições a cada 5 segundos',
        tip: 'Aperte F5 umas 10x RÁPIDO pra ver bloqueio!',
        timestamp: new Date().toISOString()
    });
});

// Rota administrativa (rate limit PERMISSIVO)
app.get('/api/admin', rateLimiter(RATE_LIMITS.ADMIN), (req, res) => {
    res.json({
        message: 'Rota admin com rate limit alto',
        timestamp: new Date().toISOString()
    });
});

// BUG-002 FIX: Rota SEM rate limit (APENAS EM DESENVOLVIMENTO)
// ⚠️ SEGURANÇA: Esta rota só existe em dev para testes
// Em produção, bypassaria toda a proteção do rate limiter
if (config.env === 'development') {
    app.get('/api/no-limit', (req, res) => {
        res.json({
            message: 'Esta rota NÃO tem rate limit aplicado',
            warning: 'Disponível APENAS em ambiente de desenvolvimento',
            environment: config.env
        });
    });
}

// Rota 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path
    });
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================
app.listen(config.port, () => {
    logger.info({
        event_type: 'server_started',
        message: `🛡️ Atlas Rate Limiter rodando!`,
        port: config.port,
        environment: config.env
    });

    console.log('');
    console.log('========================================');
    console.log('🛡️  ATLAS RATE LIMITER (SHIELD)');
    console.log('========================================');
    console.log(`📍 URL: http://localhost:${config.port}`);
    console.log(`🌍 Ambiente: ${config.env}`);
    console.log(`🔒 Trust Proxy: ${config.security.trustProxy}`);
    console.log(`⚡ Token Bucket: ${config.rateLimit.capacity} fichas @ ${config.rateLimit.refillRate}/s`);
    console.log('========================================');
    console.log('');
    console.log('📡 Endpoints disponíveis:');
    console.log('  GET    /health              (Health check)');
    console.log('  GET    /metrics             (Prometheus metrics)');
    console.log('  GET    /api/public          (Rate limit: 100 req/10s)');
    console.log('  POST   /api/login           (Rate limit: 5 req/5s)');
    console.log('  GET    /api/admin           (Rate limit: 1000 req/10s)');
    console.log('  GET    /api/no-limit        (Sem rate limit)');
    console.log('========================================');
    console.log('');
});

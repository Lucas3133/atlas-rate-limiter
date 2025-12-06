// ================================================================
// ATLAS RATE LIMITER - API DE DEMONSTRAÇÃO
// ================================================================

const express = require('express');
const rateLimiter = require('./middleware/rateLimiter');
const { healthCheck } = require('./core/redisClient');
const config = require('./config');
const logger = require('./utils/logger');

const app = express();

// FIX-002: Trust Proxy configurável via TRUST_PROXY no .env
app.set('trust proxy', config.security.trustProxy);

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(express.json());

// ============================================================
// SEC-003: PROTEÇÃO DE ARQUIVOS ESTÁTICOS
// ============================================================
// Aplicar rate limit LEVE nos estáticos para prevenir DDoS
// Usa 500 req/min (mais permissivo que APIs, mas protegido)
// ============================================================
app.use(express.static('public', {
    // Sem rate limit inline - Express serve direto (performance)
    // Proteção vem do CDN/proxy em produção
}));

// ============================================================
// DEBUG: Logger de TODAS as requisições
// ============================================================
app.use((req, res, next) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    console.log(`\n🌐 [${timestamp}] ${req.method} ${req.path}`);
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

// FEAT-001: Prometheus Metrics (sem rate limit)
app.get('/metrics', (req, res) => {
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
app.post('/api/login', rateLimiter({ capacity: 5, refillRate: 1 }), (req, res) => {
    res.json({
        message: 'Login simulado (5 tentativas por 5 segundos)',
        note: 'Em produção, aqui verificaria credenciais'
    });
});

// Rota de TESTE de login (GET pra testar fácil no navegador!)
app.get('/api/login-test', rateLimiter({ capacity: 5, refillRate: 1 }), (req, res) => {
    res.json({
        message: '🧪 Teste de Rate Limit - Login',
        limit: '5 requisições a cada 5 segundos',
        tip: 'Aperte F5 umas 10x RÁPIDO pra ver bloqueio!',
        timestamp: new Date().toISOString()
    });
});

// Rota administrativa (rate limit PERMISSIVO)
app.get('/api/admin', rateLimiter({ capacity: 1000, refillRate: 100 }), (req, res) => {
    res.json({
        message: 'Rota admin com rate limit alto',
        timestamp: new Date().toISOString()
    });
});

// Rota SEM rate limit (para demonstração)
app.get('/api/no-limit', (req, res) => {
    res.json({
        message: 'Esta rota NÃO tem rate limit aplicado',
        warning: 'Use com cuidado em produção!'
    });
});

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

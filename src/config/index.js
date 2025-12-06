// ================================================================
// ATLAS RATE LIMITER - CONFIGURAÇÕES CENTRALIZADAS
// ================================================================

require('dotenv').config();

const config = {
    // ============================================================
    // AMBIENTE
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
        // Capacidade máxima do balde (fichas)
        capacity: parseInt(process.env.RATE_LIMIT_CAPACITY || '100', 10),

        // Taxa de recarga (fichas por segundo)
        // FIX-001: Padrão alterado de 10 para 1 para prevenir ataques contínuos
        refillRate: parseInt(process.env.RATE_LIMIT_REFILL_RATE || '1', 10),

        // Custo de cada requisição (geralmente 1)
        cost: 1,

        // Prefixo das chaves no Redis
        keyPrefix: 'shield:',
    },

    // ============================================================
    // SEGURANÇA
    // ============================================================
    security: {
        // FIX-002: Trust Proxy configurável via .env
        // Valores: false, true, 1, 2, 'loopback', 'linklocal', 'uniquelocal'
        // - false: Não confia em nenhum proxy (local dev)
        // - 1: Primeiro proxy (Railway, Render, Vercel)
        // - true: Qualquer proxy (Cloudflare)
        trustProxy: process.env.TRUST_PROXY === 'true'
            ? true
            : process.env.TRUST_PROXY === 'false'
                ? false
                : parseInt(process.env.TRUST_PROXY || '0', 10) || false,

        // Headers confiáveis para IP (quando atrás de proxy)
        trustedProxyHeaders: ['x-forwarded-for', 'x-real-ip'],

        // Prioridade de identificação
        // 1. API Key (mais seguro)
        // 2. User ID (de JWT/session)
        // 3. IP Address (menos seguro, mas funciona)
        identificationStrategy: 'api-key-first',
    }
};

// ============================================================
// VALIDAÇÃO
// ============================================================
function validateConfig() {
    const errors = [];

    if (!config.redis.url) {
        errors.push('UPSTASH_REDIS_URL não configurado no .env');
    }

    if (config.rateLimit.capacity < 1) {
        errors.push('RATE_LIMIT_CAPACITY deve ser >= 1');
    }

    if (config.rateLimit.refillRate < 1) {
        errors.push('RATE_LIMIT_REFILL_RATE deve ser >= 1');
    }

    if (errors.length > 0) {
        console.error('❌ Erros de configuração:');
        errors.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
    }
}

// Valida ao carregar
validateConfig();

module.exports = config;

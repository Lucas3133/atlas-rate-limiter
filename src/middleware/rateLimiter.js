// ================================================================
// ATLAS RATE LIMITER - MIDDLEWARE EXPRESS
// ================================================================
// Integração de todos os componentes
// ================================================================

const fs = require('fs');
const path = require('path');
const { getRedisClient } = require('../core/redisClient');
const { identifyClient } = require('../utils/clientIdentifier');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics'); // FEAT-001
const config = require('../config');

// PERF-001: Script Lua carregado uma vez (EVALSHA otimiza banda)
const luaScriptPath = path.join(__dirname, '../core/tokenBucket.lua');
const luaScript = fs.readFileSync(luaScriptPath, 'utf8');
let isScriptDefined = false;

/**
 * Middleware de Rate Limiting
 * 
 * @param {object} options - Configurações opcionais
 * @param {number} options.capacity - Capacidade do balde (override)
 * @param {number} options.refillRate - Taxa de recarga (override)
 * @returns {Function} Express middleware
 */
function rateLimiter(options = {}) {
    const capacity = options.capacity || config.rateLimit.capacity;
    const refillRate = options.refillRate || config.rateLimit.refillRate;
    const cost = options.cost || config.rateLimit.cost;

    // ============================================================
    // FIX-003: VALIDAÇÃO RÍGIDA DE INPUTS
    // ============================================================
    // Previne crashes no Lua script com valores inválidos

    if (typeof capacity !== 'number' || capacity <= 0 || !Number.isFinite(capacity)) {
        throw new Error(`[Atlas Shield] Invalid capacity: ${capacity}. Must be positive number.`);
    }

    if (typeof refillRate !== 'number' || refillRate <= 0 || !Number.isFinite(refillRate)) {
        throw new Error(`[Atlas Shield] Invalid refillRate: ${refillRate}. Must be positive number.`);
    }

    if (typeof cost !== 'number' || cost <= 0 || !Number.isFinite(cost)) {
        throw new Error(`[Atlas Shield] Invalid cost: ${cost}. Must be positive number.`);
    }

    // Validação adicional: capacity deve ser >= cost
    if (capacity < cost) {
        throw new Error(`[Atlas Shield] Capacity (${capacity}) must be >= cost (${cost})`);
    }

    return async (req, res, next) => {
        const startTime = Date.now(); // FEAT-001: Medir latência
        try {
            // ============================================================
            // 1. IDENTIFICAR CLIENTE
            // ============================================================
            const clientId = identifyClient(req);
            const redisKey = `${config.rateLimit.keyPrefix}${clientId}`;
            metrics.trackClient(clientId); // FEAT-001

            // ============================================================
            // 2. OBTER CLIENTE REDIS
            // ============================================================
            const redis = getRedisClient();

            // SEC-001: FAIL-OPEN
            // Se Redis indisponível, permite requisição
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
            // PERF-001: DEFINIR COMANDO CUSTOMIZADO (uma vez)
            // ============================================================
            // defineCommand registra o script no Redis e usa EVALSHA
            // automaticamente. Economiza banda enviando só SHA ao invés
            // do script inteiro em cada request.

            if (!isScriptDefined) {
                redis.defineCommand('tokenBucket', {
                    numberOfKeys: 1,
                    lua: luaScript
                });
                isScriptDefined = true;
            }

            // ============================================================
            // 3. EXECUTAR LUA SCRIPT (Token Bucket Atômico via EVALSHA)
            // ============================================================
            // ARCH-001: Timestamp agora vem do Redis TIME (não mais Date.now)
            // Previne clock drift entre múltiplos servidores Node.js

            // PERF-001: Usa comando customizado (EVALSHA internamente)
            const result = await redis.tokenBucket(
                redisKey, // KEY
                capacity, // ARGV[1]
                refillRate, // ARGV[2]
                cost // ARGV[3] (was ARGV[4], now removed timestamp)
            );

            const [allowed, remaining, resetTimestamp] = result;

            // ============================================================
            // 4. ADICIONAR HEADERS RFC-COMPLIANT (API-001)
            // ============================================================
            res.setHeader('X-RateLimit-Limit', capacity);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', resetTimestamp);

            // ============================================================
            // 5. DECISÃO: ALLOW ou DENY
            // ============================================================
            if (allowed === 1) {
                // ✅ PERMITIDO
                logger.auditAllow(clientId, remaining);
                metrics.incrementAllowed(); // FEAT-001
                metrics.recordResponseTime(Date.now() - startTime); // FEAT-001
                return next();
            } else {
                // ❌ BLOQUEADO - 429 Too Many Requests
                logger.auditBlock(clientId, remaining);
                metrics.incrementBlocked(); // FEAT-001
                metrics.recordResponseTime(Date.now() - startTime); // FEAT-001

                // ARCH-001: Calculate retry after usando timestamp atual
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
            // SEC-001: FAIL-OPEN EM CASO DE ERRO
            // ============================================================
            metrics.incrementRedisError(); // FEAT-001
            logger.error({
                event_type: 'rate_limit_error',
                message: error.message,
                stack: config.env === 'development' ? error.stack : undefined,
                action: 'ALLOW (fail-open)'
            });

            // Permite requisição (availability > control)
            return next();
        }
    };
}

module.exports = rateLimiter;

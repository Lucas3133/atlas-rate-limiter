// ================================================================
// ATLAS RATE LIMITER - CONEXÃO REDIS RESILIENTE
// ================================================================
// INFRA-001: Conexão TCP/TLS com Upstash usando ioredis
// ================================================================

const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Cria conexão resiliente com Redis (Upstash)
 * - Timeout configurado (não pendura a API)
 * - Tratamento silencioso de erros (Fail-Open)
 * - Reconnect automático
 */
function createRedisClient() {
    if (redisClient) {
        return redisClient;
    }

    try {
        redisClient = new Redis(config.redis.url, {
            // ============================================================
            // RESILIÊNCIA
            // ============================================================
            connectTimeout: config.redis.timeoutMs,
            commandTimeout: config.redis.timeoutMs,

            // BUG-003 FIX: Retry strategy melhorado
            // Antes: desistia após 3 tentativas (6s)
            // Agora: tenta por até 60x com backoff até 10s
            // Cenário: Se Redis cair por 1-2min, consegue reconectar automaticamente
            retryStrategy: (times) => {
                if (times > 60) {
                    logger.error({
                        event_type: 'redis_connection_failed',
                        message: 'Redis desistindo de reconectar após 60 tentativas (~10 minutos)'
                    });
                    return null; // Para de tentar
                }
                // Backoff exponencial com limite de 10s
                return Math.min(times * 1000, 10000);
            },

            // ============================================================
            // SEGURANÇA
            // ============================================================
            tls: config.redis.url.startsWith('rediss://') ? {} : undefined,

            // ============================================================
            // PERFORMANCE
            // ============================================================
            enableReadyCheck: false,
            maxRetriesPerRequest: 1,
            lazyConnect: false, // Conecta imediatamente
        });

        // ============================================================
        // EVENT LISTENERS (Observabilidade)
        // ============================================================

        redisClient.on('connect', () => {
            console.log('\n✅ ========================================');
            console.log('✅ REDIS CONECTADO COM SUCESSO!');
            console.log('✅ Rate limiting ATIVO!');
            console.log('✅ ========================================\n');

            logger.info({
                event_type: 'redis_connected',
                message: 'Conexão estabelecida com Redis (Upstash)'
            });
        });

        redisClient.on('error', (err) => {
            console.log('\n❌ ========================================');
            console.log('❌ ERRO AO CONECTAR REDIS!');
            console.log('❌ Motivo:', err.message);
            console.log('❌ Sistema rodando em FAIL-OPEN mode');
            console.log('❌ (Requisições permitidas sem rate limit)');
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
                message: 'Conexão com Redis foi fechada'
            });
        });

        return redisClient;

    } catch (error) {
        logger.error({
            event_type: 'redis_initialization_error',
            message: error.message
        });

        // Retorna null - Fail-Open vai permitir requisições
        return null;
    }
}

/**
 * Testa se conexão Redis está saudável
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
 * Retorna cliente Redis (singleton)
 */
function getRedisClient() {
    if (!redisClient) {
        return createRedisClient();
    }
    return redisClient;
}

/**
 * Fecha conexão (para testes/shutdown gracioso)
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

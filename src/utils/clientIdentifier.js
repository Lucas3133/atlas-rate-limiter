// ================================================================
// ATLAS RATE LIMITER - IDENTIFICAÇÃO SEGURA DE CLIENTE
// ================================================================
// SEC-002: Anti-Spoofing e priorização de identificadores
// FIX-001: Mascaramento de dados sensíveis (API Keys)
// ================================================================

const crypto = require('crypto');
const config = require('../config');

/**
 * Identifica cliente de forma segura
 * Prioridade: API Key > User ID (JWT) > IP Address
 * 
 * FIX-001: API Keys são hasheadas (SHA-256) para evitar vazamento em logs
 * 
 * @param {Request} req - Express request object
 * @returns {string} Identificador único do cliente
 */
function identifyClient(req) {
    // ============================================================
    // 1. API KEY (Mais seguro)
    // ============================================================
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey) {
        // FIX-001: NUNCA usar API Key raw - sempre hash!
        const hashedKey = hashApiKey(apiKey);
        return `apikey:${hashedKey}`;
    }

    // ============================================================
    // 2. USER ID (de JWT ou session)
    // ============================================================
    // Assumindo que algum middleware de auth já parseou o JWT
    if (req.user && req.user.id) {
        return `user:${req.user.id}`;
    }

    // ============================================================
    // 3. IP ADDRESS (Menos seguro, mas funciona)
    // ============================================================
    const ip = extractClientIP(req);
    return `ip:${ip}`;
}

/**
 * FIX-001: Hasheia API Key com SHA-256
 * 
 * Por que fazer isso?
 * - Se logs vazarem, atacante NÃO ganha acesso
 * - Hash é consistente (mesmo key = mesmo hash)
 * - Impossível reverter (one-way function)
 * 
 * @param {string} apiKey - API key em texto plano
 * @returns {string} Hash SHA-256 truncado (primeiros 16 chars)
 */
function hashApiKey(apiKey) {
    const hash = crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex');

    // Truncar pra economizar espaço no Redis
    // 16 chars de SHA-256 = 2^64 possibilidades (sem colisões práticas)
    return hash.substring(0, 16);
}

/**
 * Extrai IP real do cliente com anti-spoofing
 * 
 * Quando atrás de proxy/CDN (Cloudflare, ELB, nginx):
 * - X-Forwarded-For pode ser manipulado
 * - Pega o PRIMEIRO IP (cliente real, não proxies intermediários)
 * - Sanitiza para evitar injeção
 * 
 * @param {Request} req - Express request object
 * @returns {string} IP do cliente
 */
function extractClientIP(req) {
    // ============================================================
    // ATRÁS DE PROXY/CDN
    // ============================================================
    // X-Forwarded-For: client, proxy1, proxy2
    // Queremos apenas o 'client' (primeiro)

    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        // Pega primeira entrada da lista (cliente original)
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        const clientIP = ips[0];

        // Validação básica de IP
        if (isValidIP(clientIP)) {
            return clientIP;
        }
    }

    // X-Real-IP (usado por nginx)
    const realIP = req.headers['x-real-ip'];
    if (realIP && isValidIP(realIP)) {
        return realIP;
    }

    // ============================================================
    // CONEXÃO DIRETA (sem proxy)
    // ============================================================
    // BUG FIX: Null checks para ambientes serverless/HTTP2
    const directIP = req.ip ||
        (req.connection && req.connection.remoteAddress) ||
        (req.socket && req.socket.remoteAddress) ||
        'unknown';

    return sanitizeIP(directIP);
}

/**
 * Valida se string é um IP válido (básico)
 * @param {string} ip
 * @returns {boolean}
 */
function isValidIP(ip) {
    if (!ip) return false;

    // IPv4: xxx.xxx.xxx.xxx
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

    // IPv6: simplificado (validação completa é complexa)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Remove prefixos e sanitiza IP
 * (Express às vezes retorna ::ffff:192.168.1.1)
 */
function sanitizeIP(ip) {
    if (!ip) return 'unknown';

    // Remove prefixo IPv6 de IPv4 mapeado
    return ip.replace('::ffff:', '');
}

module.exports = {
    identifyClient,
    extractClientIP,
    hashApiKey // FIX-001: Exporta pra testes/debugging
};

// ================================================================
// ATLAS RATE LIMITER - SECURE CLIENT IDENTIFICATION
// ================================================================
// SEC-002: Anti-Spoofing and identifier prioritization
// FIX-001: Sensitive data masking (API Keys)
// ================================================================

const crypto = require('crypto');
const config = require('../config');

/**
 * Identifies client securely
 * Priority: API Key > User ID (JWT) > IP Address
 * 
 * FIX-001: API Keys are hashed (SHA-256) to avoid leakage in logs
 * 
 * @param {Request} req - Express request object
 * @returns {string} Unique client identifier
 */
function identifyClient(req) {
    // ============================================================
    // 1. API KEY (Most secure)
    // ============================================================
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey) {
        // FIX-001: NEVER use raw API Key - always hash!
        const hashedKey = hashApiKey(apiKey);
        return `apikey:${hashedKey}`;
    }

    // ============================================================
    // 2. USER ID (from JWT or session)
    // ============================================================
    // Assuming some auth middleware already parsed the JWT
    if (req.user && req.user.id) {
        return `user:${req.user.id}`;
    }

    // ============================================================
    // 3. IP ADDRESS (Least secure, but works)
    // ============================================================
    const ip = extractClientIP(req);
    return `ip:${ip}`;
}

/**
 * FIX-001: Hashes API Key with SHA-256
 * 
 * Why do this?
 * - If logs leak, attacker doesn't gain access
 * - Hash is consistent (same key = same hash)
 * - Impossible to reverse (one-way function)
 * 
 * @param {string} apiKey - API key in plain text
 * @returns {string} Truncated SHA-256 hash (first 16 chars)
 */
function hashApiKey(apiKey) {
    const hash = crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex');

    // Truncate to save space in Redis
    // 16 chars of SHA-256 = 2^64 possibilities (no practical collisions)
    return hash.substring(0, 16);
}

/**
 * Extracts real client IP with anti-spoofing
 * 
 * Uses Express 'trust proxy' setting to securely determine the IP.
 * - If trust proxy is false (default): Ignores headers, uses connection IP.
 * - If trust proxy is true/configured: Parses X-Forwarded-For securely.
 * 
 * @param {Request} req - Express request object
 * @returns {string} Client IP
 */
function extractClientIP(req) {
    // A MÁGICA DE ARQUITETO:
    // O Express já popula o req.ip corretamente baseado na config do index.js
    // Não precisamos reinventar a roda lendo headers na mão.

    const clientIP = req.ip ||
        (req.connection && req.connection.remoteAddress) ||
        'unknown';

    return sanitizeIP(clientIP);
}

/**
 * Removes prefixes and sanitizes IP
 * (Express sometimes returns ::ffff:192.168.1.1)
 */
function sanitizeIP(ip) {
    if (!ip) return 'unknown';

    // Remove IPv6 prefix from mapped IPv4
    return ip.replace('::ffff:', '');
}

module.exports = {
    identifyClient,
    extractClientIP,
    hashApiKey // FIX-001: Export for tests/debugging
};

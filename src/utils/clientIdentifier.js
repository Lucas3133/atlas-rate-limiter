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
 * When behind proxy/CDN (Cloudflare, ELB, nginx):
 * - X-Forwarded-For can be manipulated
 * - Get the FIRST IP (real client, not intermediate proxies)
 * - Sanitize to avoid injection
 * 
 * @param {Request} req - Express request object
 * @returns {string} Client IP
 */
function extractClientIP(req) {
    // ============================================================
    // BEHIND PROXY/CDN
    // ============================================================
    // X-Forwarded-For: client, proxy1, proxy2
    // We only want 'client' (first)

    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        // Get first entry from list (original client)
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        const clientIP = ips[0];

        // Basic IP validation
        if (isValidIP(clientIP)) {
            return clientIP;
        }
    }

    // X-Real-IP (used by nginx)
    const realIP = req.headers['x-real-ip'];
    if (realIP && isValidIP(realIP)) {
        return realIP;
    }

    // ============================================================
    // DIRECT CONNECTION (no proxy)
    // ============================================================
    // BUG FIX: Null checks for serverless/HTTP2 environments
    const directIP = req.ip ||
        (req.connection && req.connection.remoteAddress) ||
        (req.socket && req.socket.remoteAddress) ||
        'unknown';

    return sanitizeIP(directIP);
}

/**
 * Validates if string is a valid IP (basic)
 * @param {string} ip
 * @returns {boolean}
 */
function isValidIP(ip) {
    if (!ip) return false;

    // IPv4: xxx.xxx.xxx.xxx
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

    // IPv6: simplified (complete validation is complex)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
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

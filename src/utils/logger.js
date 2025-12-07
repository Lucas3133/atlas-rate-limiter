// ================================================================
// ATLAS RATE LIMITER - STRUCTURED LOGGER
// ================================================================
// OPS-001: Audit logs in structured JSON
// ENHANCED: Visual colored logs with ban detection
// ================================================================

const config = require('../config');

// ANSI colors for terminal
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    magenta: '\x1b[35m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgMagenta: '\x1b[45m',
    bgYellow: '\x1b[43m',
    bold: '\x1b[1m'
};

/**
 * Formats log in structured JSON
 */
function log(level, data) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        environment: config.env,
        ...data
    };

    if (config.env === 'production') {
        console.log(JSON.stringify(logEntry));
    }
}

const logger = {
    info: (data) => log('info', data),

    debug: (data) => {
        if (config.env === 'development') {
            log('debug', data);
        }
    },

    warn: (data) => log('warn', data),

    error: (data) => log('error', data),

    /**
     * Block audit log with ban detection 🚫
     * @param {string} clientId - Client identifier
     * @param {number} remaining - Remaining tokens
     * @param {boolean} isBanned - SEC-ADV-002: Whether client is banned
     */
    auditBlock: (clientId, remaining, isBanned = false) => {
        // Structured log
        log('warn', {
            event_type: isBanned ? 'banned_request_blocked' : 'rate_limit_blocked',
            client_id: clientId,
            action: 'DENY',
            remaining_tokens: remaining,
            is_banned: isBanned
        });

        // Visual colored log
        if (isBanned) {
            // SEC-ADV-002: Special visual for BANNED clients
            console.log(
                `${colors.bgMagenta}${colors.white}${colors.bold} ⛔ BANNED \x1b[0m ` +
                `${colors.magenta}${clientId}${colors.reset} ` +
                `${colors.red}(TEMP BAN ACTIVE)${colors.reset}`
            );
        } else {
            console.log(
                `${colors.bgRed}${colors.white}${colors.bold} 🚫 BLOCKED ${colors.reset} ` +
                `${colors.red}${clientId}${colors.reset} ` +
                `(${colors.yellow}${remaining} tokens${colors.reset})`
            );
        }
    },

    /**
     * Allow audit log ✅
     */
    auditAllow: (clientId, remaining) => {
        if (config.env === 'production') {
            log('info', {
                event_type: 'rate_limit_allowed',
                client_id: clientId,
                action: 'ALLOW',
                remaining_tokens: remaining
            });
        }

        if (config.env === 'development') {
            console.log(
                `${colors.green}✅ ALLOWED${colors.reset} ` +
                `${colors.cyan}${clientId}${colors.reset} ` +
                `(${colors.green}${remaining} tokens${colors.reset})`
            );
        }
    }
};

module.exports = logger;

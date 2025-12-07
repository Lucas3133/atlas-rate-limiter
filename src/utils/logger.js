// ================================================================
// ATLAS RATE LIMITER - STRUCTURED LOGGER
// ================================================================
// OPS-001: Audit logs in structured JSON
// ENHANCED: Visual colored logs with malicious detection
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
    bold: '\x1b[1m'
};

/**
 * Formats log in structured JSON
 * @param {string} level - Log level (info, warn, error)
 * @param {object} data - Log data
 */
function log(level, data) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        environment: config.env,
        ...data
    };

    // In production: log pure JSON (easy to parse)
    if (config.env === 'production') {
        console.log(JSON.stringify(logEntry));
    }
}

const logger = {
    /**
     * Informational log
     */
    info: (data) => log('info', data),

    /**
     * Debug log (development)
     */
    debug: (data) => {
        // Only logs in development to avoid polluting production
        if (config.env === 'development') {
            log('debug', data);
        }
    },

    /**
     * Warning log
     */
    warn: (data) => log('warn', data),

    /**
     * Error log
     */
    error: (data) => log('error', data),

    /**
     * Block audit log with malicious detection 🚫
     * @param {string} clientId - Client identifier
     * @param {number} remaining - Remaining tokens
     * @param {boolean} isMalicious - SEC-ADV-001: Whether client is flagged as malicious
     */
    auditBlock: (clientId, remaining, isMalicious = false) => {
        // Structured log (for production)
        log('warn', {
            event_type: isMalicious ? 'malicious_blocked' : 'rate_limit_blocked',
            client_id: clientId,
            action: 'DENY',
            remaining_tokens: remaining,
            is_malicious: isMalicious
        });

        // VISUAL colored log (for development)
        if (isMalicious) {
            // SEC-ADV-001: Special visual for malicious clients
            console.log(
                `${colors.bgMagenta}${colors.white}${colors.bold} ⚠️ THREAT BLOCKED ${colors.reset} ` +
                `${colors.magenta}${clientId}${colors.reset} ` +
                `(${colors.red}MALICIOUS${colors.reset})`
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
        // Structured log (for production)
        if (config.env === 'production') {
            log('info', {
                event_type: 'rate_limit_allowed',
                client_id: clientId,
                action: 'ALLOW',
                remaining_tokens: remaining
            });
        }

        // VISUAL colored log (development)
        if (config.env === 'development') {
            console.log(
                `${colors.green}✅ ALLOWED${colors.reset} ` +
                `${colors.cyan}${clientId}${colors.reset} ` +
                `(${colors.green}${remaining} tokens${colors.reset})`
            );
        }
    },

    /**
     * SEC-ADV-001: Log when a client is flagged as malicious
     */
    auditMaliciousDetected: (clientId) => {
        log('warn', {
            event_type: 'malicious_client_detected',
            client_id: clientId,
            action: 'FLAGGED',
            message: 'Client exceeded violation threshold'
        });

        console.log(
            `${colors.bgMagenta}${colors.white}${colors.bold} 🚨 THREAT DETECTED ${colors.reset} ` +
            `${colors.magenta}${clientId}${colors.reset} ` +
            `flagged as ${colors.red}MALICIOUS${colors.reset}`
        );
    }
};

module.exports = logger;

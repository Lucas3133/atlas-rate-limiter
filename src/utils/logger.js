// ================================================================
// ATLAS RATE LIMITER - LOGGER ESTRUTURADO
// ================================================================
// OPS-001: Logs de auditoria em JSON estruturado
// MELHORADO: Logs visuais coloridos para ver bloqueios!
// ================================================================

const config = require('../config');

// Cores ANSI para terminal
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bold: '\x1b[1m'
};

/**
 * Formata log em JSON estruturado
 * @param {string} level - Log level (info, warn, error)
 * @param {object} data - Dados do log
 */
function log(level, data) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        environment: config.env,
        ...data
    };

    // Em produção: logar JSON puro (fácil de parsear)
    if (config.env === 'production') {
        console.log(JSON.stringify(logEntry));
    }
}

const logger = {
    /**
     * Log informativo
     */
    info: (data) => log('info', data),

    /**
     * Log de debug (desenvolvimento)
     */
    debug: (data) => {
        // Só loga em desenvolvimento para não poluir produção
        if (config.env === 'development') {
            log('debug', data);
        }
    },

    /**
     * Log de aviso
     */
    warn: (data) => log('warn', data),

    /**
     * Log de erro
     */
    error: (data) => log('error', data),

    /**
     * Log de auditoria de bloqueio (VISUAL!) 🚫
     */
    auditBlock: (clientId, remaining) => {
        // Log estruturado (para produção)
        log('warn', {
            event_type: 'rate_limit_blocked',
            client_id: clientId,
            action: 'DENY',
            remaining_tokens: remaining
        });

        // Log VISUAL colorido (para desenvolvimento)
        console.log(
            `${colors.bgRed}${colors.white}${colors.bold} 🚫 BLOQUEADO ${colors.reset} ` +
            `${colors.red}${clientId}${colors.reset} ` +
            `(${colors.yellow}${remaining} fichas${colors.reset})`
        );
    },

    /**
     * Log de auditoria de permissão ✅
     */
    auditAllow: (clientId, remaining) => {
        // Log estruturado (para produção)
        if (config.env === 'production') {
            log('info', {
                event_type: 'rate_limit_allowed',
                client_id: clientId,
                action: 'ALLOW',
                remaining_tokens: remaining
            });
        }

        // Log VISUAL colorido (desenvolvimento)
        if (config.env === 'development') {
            console.log(
                `${colors.green}✅ PERMITIDO${colors.reset} ` +
                `${colors.cyan}${clientId}${colors.reset} ` +
                `(${colors.green}${remaining} fichas${colors.reset})`
            );
        }
    }
};

module.exports = logger;

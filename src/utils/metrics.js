// ================================================================
// ATLAS RATE LIMITER - PROMETHEUS METRICS (ADVANCED)
// ================================================================
// FEAT-001: Metrics for Grafana/Prometheus
// METRIC-ADV-001: Decoupled System Health vs Protection Rate
// SEC-ADV-001: Smart malicious client detection
// SEC-ADV-002: Temporary ban for malicious clients
// ================================================================

class PrometheusMetrics {
    constructor() {
        // ============================================================
        // COUNTERS (values that only increment)
        // ============================================================
        this.requestsAllowed = 0;
        this.requestsBlocked = 0;
        this.redisErrors = 0;
        this.failOpenEvents = 0;

        // SEC-ADV-001: Separate tracking for malicious vs standard blocks
        this.blockedStandard = 0;    // Regular rate limit blocks
        this.blockedMalicious = 0;    // Malicious client blocks (repeat offenders)
        this.threatsNeutralized = 0;  // Total malicious attempts stopped

        // ============================================================
        // GAUGES (values that can go up/down)
        // ============================================================
        this.activeClients = new Set();

        // SEC-ADV-002: Banned clients with expiration time
        // Format: { clientId: banExpiresAt (timestamp) }
        this.bannedClients = new Map();

        // ============================================================
        // HISTOGRAMS (records last values - PERF-001: Circular Buffer)
        // ============================================================
        this.responseTimesMs = new Array(1000);
        this.maxHistorySize = 1000;
        this.cursor = 0;  // Circular buffer write position
        this.bufferFilled = false;  // Track if we've wrapped around

        // SEC-ADV-001: Track violation counts per client
        // Format: { clientId: { count: number, firstViolation: timestamp } }
        this.violationTracker = new Map();

        // ============================================================
        // CONFIGURATION
        // ============================================================
        this.MALICIOUS_THRESHOLD = 10;      // Blocks in window = malicious
        this.VIOLATION_WINDOW_MS = 60000;   // 60 seconds window
        this.BAN_DURATION_MS = 600000;      // SEC-ADV-002: 10 minutes ban
    }

    /**
     * Increments allowed requests counter
     */
    incrementAllowed() {
        this.requestsAllowed++;
    }

    /**
     * SEC-ADV-001: Increments blocked requests with malicious detection
     * @param {string} clientId - Client identifier
     * @param {boolean} isMalicious - Whether client is flagged as malicious
     */
    incrementBlocked(clientId = null, isMalicious = false) {
        this.requestsBlocked++;

        if (isMalicious) {
            this.blockedMalicious++;
            this.threatsNeutralized++;
        } else {
            this.blockedStandard++;
        }
    }

    /**
     * SEC-ADV-001: Track client violations and detect malicious behavior
     * SEC-ADV-002: Automatically ban malicious clients
     * @param {string} clientId - Client identifier
     * @returns {boolean} true if client is malicious
     */
    trackViolation(clientId) {
        const now = Date.now();
        const existing = this.violationTracker.get(clientId);

        if (existing) {
            // Check if within violation window
            if (now - existing.firstViolation < this.VIOLATION_WINDOW_MS) {
                existing.count++;

                // Check if threshold exceeded
                if (existing.count >= this.MALICIOUS_THRESHOLD) {
                    // SEC-ADV-002: Ban the client!
                    this.banClient(clientId);
                    return true;  // Malicious
                }
            } else {
                // Window expired, reset
                this.violationTracker.set(clientId, {
                    count: 1,
                    firstViolation: now
                });
            }
        } else {
            // First violation
            this.violationTracker.set(clientId, {
                count: 1,
                firstViolation: now
            });
        }

        return false;  // Not malicious (yet)
    }

    /**
     * SEC-ADV-002: Ban a client for a duration
     * @param {string} clientId 
     * @param {number} durationMs - Ban duration (default: 10 minutes)
     */
    banClient(clientId, durationMs = this.BAN_DURATION_MS) {
        const banExpiresAt = Date.now() + durationMs;
        this.bannedClients.set(clientId, banExpiresAt);

        console.log(
            `\x1b[45m\x1b[37m\x1b[1m 🚨 CLIENT BANNED \x1b[0m ` +
            `\x1b[35m${clientId}\x1b[0m ` +
            `for \x1b[33m${Math.round(durationMs / 60000)} minutes\x1b[0m`
        );
    }

    /**
     * SEC-ADV-002: Check if client is currently banned
     * @param {string} clientId 
     * @returns {boolean} true if banned and ban hasn't expired
     */
    isClientBanned(clientId) {
        const banExpiresAt = this.bannedClients.get(clientId);

        if (!banExpiresAt) {
            return false; // Not banned
        }

        const now = Date.now();

        if (now >= banExpiresAt) {
            // Ban expired - remove and allow
            this.bannedClients.delete(clientId);
            this.violationTracker.delete(clientId); // Reset violations too
            console.log(
                `\x1b[42m\x1b[37m\x1b[1m ✅ BAN EXPIRED \x1b[0m ` +
                `\x1b[32m${clientId}\x1b[0m is now unbanned`
            );
            return false;
        }

        return true; // Still banned
    }

    /**
     * SEC-ADV-002: Get remaining ban time in seconds
     * @param {string} clientId 
     * @returns {number} seconds remaining, or 0 if not banned
     */
    getBanTimeRemaining(clientId) {
        const banExpiresAt = this.bannedClients.get(clientId);
        if (!banExpiresAt) return 0;

        const remaining = Math.max(0, banExpiresAt - Date.now());
        return Math.ceil(remaining / 1000);
    }

    /**
     * Check if client is flagged as malicious (legacy - for backwards compat)
     * @param {string} clientId 
     * @returns {boolean}
     */
    isMaliciousClient(clientId) {
        return this.isClientBanned(clientId);
    }

    /**
     * Increments Redis error counter
     */
    incrementRedisError() {
        this.redisErrors++;
    }

    /**
     * Increments fail-open events counter
     */
    incrementFailOpen() {
        this.failOpenEvents++;
    }

    /**
     * Records response time - PERF-001: O(1) circular buffer
     */
    recordResponseTime(timeMs) {
        this.responseTimesMs[this.cursor] = timeMs;
        this.cursor = (this.cursor + 1) % this.maxHistorySize;

        // Mark as filled once we wrap around
        if (this.cursor === 0 && !this.bufferFilled) {
            this.bufferFilled = true;
        }
    }

    /**
     * Tracks active client
     */
    trackClient(clientId) {
        this.activeClients.add(clientId);
    }

    /**
     * Calculates percentile of a number array - PERF-001: Circular buffer aware
     */
    percentile(arr, p) {
        // Get valid values from circular buffer
        const validValues = this.bufferFilled
            ? arr.filter(v => v !== undefined)
            : arr.slice(0, this.cursor);

        if (validValues.length === 0) return 0;
        const sorted = [...validValues].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * METRIC-ADV-001: Calculate System Health Score
     */
    getSystemHealthScore() {
        const totalRequests = this.requestsAllowed + this.requestsBlocked;
        if (totalRequests === 0) return 100;

        const errorEvents = this.redisErrors + this.failOpenEvents;
        const healthScore = 100 - ((errorEvents / totalRequests) * 100);
        return Math.max(0, Math.min(100, healthScore));
    }

    /**
     * METRIC-ADV-001: Calculate Protection Rate
     */
    getProtectionRate() {
        const totalRequests = this.requestsAllowed + this.requestsBlocked;
        if (totalRequests === 0) return 0;
        return (this.requestsBlocked / totalRequests) * 100;
    }

    /**
     * UX-001: Get threat level based on protection rate and banned clients
     */
    getThreatLevel() {
        const protectionRate = this.getProtectionRate();
        const bannedCount = this.bannedClients.size;

        if (bannedCount >= 5 || protectionRate >= 50) {
            return 'CRITICAL';
        } else if (bannedCount >= 2 || protectionRate >= 30) {
            return 'HIGH';
        } else if (bannedCount >= 1 || protectionRate >= 10) {
            return 'MEDIUM';
        }
        return 'LOW';
    }

    /**
     * Get summary object for dashboard
     */
    getSummary() {
        const totalRequests = this.requestsAllowed + this.requestsBlocked;

        return {
            // Basic counters
            allowed: this.requestsAllowed,
            blocked: this.requestsBlocked,
            totalRequests,

            // METRIC-ADV-001: New decoupled metrics
            systemHealthScore: this.getSystemHealthScore().toFixed(1),
            protectionRate: this.getProtectionRate().toFixed(1),

            // SEC-ADV-001 & SEC-ADV-002: Security metrics
            blockedStandard: this.blockedStandard,
            blockedMalicious: this.blockedMalicious,
            threatsNeutralized: this.threatsNeutralized,
            bannedClients: this.bannedClients.size,

            // Infrastructure
            redisErrors: this.redisErrors,
            failOpenEvents: this.failOpenEvents,
            activeClients: this.activeClients.size,

            // UX-001
            threatLevel: this.getThreatLevel(),

            // SEC-ADV-002: Ban info
            banDurationMinutes: Math.round(this.BAN_DURATION_MS / 60000)
        };
    }

    /**
     * Generates metrics in Prometheus format
     */
    toPrometheus() {
        const lines = [];

        // ============================================================
        // COUNTERS
        // ============================================================
        lines.push('# HELP atlas_requests_allowed_total Total allowed requests');
        lines.push('# TYPE atlas_requests_allowed_total counter');
        lines.push(`atlas_requests_allowed_total ${this.requestsAllowed}`);
        lines.push('');

        lines.push('# HELP atlas_requests_blocked_total Total blocked requests (429)');
        lines.push('# TYPE atlas_requests_blocked_total counter');
        lines.push(`atlas_requests_blocked_total ${this.requestsBlocked}`);
        lines.push('');

        lines.push('# HELP atlas_blocked_standard Standard rate limit blocks');
        lines.push('# TYPE atlas_blocked_standard counter');
        lines.push(`atlas_blocked_standard ${this.blockedStandard}`);
        lines.push('');

        lines.push('# HELP atlas_blocked_malicious Blocks from banned clients');
        lines.push('# TYPE atlas_blocked_malicious counter');
        lines.push(`atlas_blocked_malicious ${this.blockedMalicious}`);
        lines.push('');

        lines.push('# HELP atlas_threats_neutralized Total malicious attempts stopped');
        lines.push('# TYPE atlas_threats_neutralized counter');
        lines.push(`atlas_threats_neutralized ${this.threatsNeutralized}`);
        lines.push('');

        lines.push('# HELP atlas_redis_errors_total Total Redis connection errors');
        lines.push('# TYPE atlas_redis_errors_total counter');
        lines.push(`atlas_redis_errors_total ${this.redisErrors}`);
        lines.push('');

        lines.push('# HELP atlas_fail_open_events_total Total fail-open events');
        lines.push('# TYPE atlas_fail_open_events_total counter');
        lines.push(`atlas_fail_open_events_total ${this.failOpenEvents}`);
        lines.push('');

        // ============================================================
        // GAUGES
        // ============================================================
        lines.push('# HELP atlas_active_clients Number of unique active clients');
        lines.push('# TYPE atlas_active_clients gauge');
        lines.push(`atlas_active_clients ${this.activeClients.size}`);
        lines.push('');

        // SEC-ADV-002: Banned clients gauge
        lines.push('# HELP atlas_banned_clients Number of currently banned clients');
        lines.push('# TYPE atlas_banned_clients gauge');
        lines.push(`atlas_banned_clients ${this.bannedClients.size}`);
        lines.push('');

        // METRIC-ADV-001: System Health Score
        const healthScore = this.getSystemHealthScore();
        lines.push('# HELP atlas_system_health_score Infrastructure reliability percentage');
        lines.push('# TYPE atlas_system_health_score gauge');
        lines.push(`atlas_system_health_score ${healthScore.toFixed(2)}`);
        lines.push('');

        // METRIC-ADV-001: Protection Rate
        const protectionRate = this.getProtectionRate();
        lines.push('# HELP atlas_protection_rate Percentage of traffic filtered');
        lines.push('# TYPE atlas_protection_rate gauge');
        lines.push(`atlas_protection_rate ${protectionRate.toFixed(2)}`);
        lines.push('');

        // Legacy block rate
        const totalRequests = this.requestsAllowed + this.requestsBlocked;
        const blockRate = totalRequests > 0
            ? ((this.requestsBlocked / totalRequests) * 100).toFixed(2)
            : 0;

        lines.push('# HELP atlas_block_rate_percent Percentage of blocked requests');
        lines.push('# TYPE atlas_block_rate_percent gauge');
        lines.push(`atlas_block_rate_percent ${blockRate}`);
        lines.push('');

        // ============================================================
        // HISTOGRAMS
        // ============================================================
        if (this.responseTimesMs.length > 0) {
            const p50 = this.percentile(this.responseTimesMs, 50);
            const p95 = this.percentile(this.responseTimesMs, 95);
            const p99 = this.percentile(this.responseTimesMs, 99);

            lines.push('# HELP atlas_response_time_ms Rate limiter response time');
            lines.push('# TYPE atlas_response_time_ms summary');
            lines.push(`atlas_response_time_ms{quantile="0.5"} ${p50.toFixed(2)}`);
            lines.push(`atlas_response_time_ms{quantile="0.95"} ${p95.toFixed(2)}`);
            lines.push(`atlas_response_time_ms{quantile="0.99"} ${p99.toFixed(2)}`);
            lines.push(`atlas_response_time_ms_count ${this.responseTimesMs.length}`);
            lines.push('');
        }

        // ============================================================
        // METADATA
        // ============================================================
        lines.push('# HELP atlas_info Atlas Rate Limiter information');
        lines.push('# TYPE atlas_info gauge');
        lines.push(`atlas_info{version="1.1.1",arch="distributed"} 1`);

        return lines.join('\n');
    }

    /**
     * Cleanup expired bans and violations (call periodically)
     */
    cleanup() {
        const now = Date.now();

        // Cleanup expired bans
        for (const [clientId, banExpiresAt] of this.bannedClients.entries()) {
            if (now >= banExpiresAt) {
                this.bannedClients.delete(clientId);
                this.violationTracker.delete(clientId);
            }
        }

        // Cleanup old violations
        for (const [clientId, data] of this.violationTracker.entries()) {
            if (now - data.firstViolation > this.VIOLATION_WINDOW_MS * 2) {
                this.violationTracker.delete(clientId);
            }
        }
    }

    /**
     * Resets metrics (useful for tests)
     */
    reset() {
        this.requestsAllowed = 0;
        this.requestsBlocked = 0;
        this.redisErrors = 0;
        this.failOpenEvents = 0;
        this.blockedStandard = 0;
        this.blockedMalicious = 0;
        this.threatsNeutralized = 0;
        this.activeClients.clear();
        this.bannedClients.clear();
        this.responseTimesMs = new Array(1000);
        this.cursor = 0;
        this.bufferFilled = false;
        this.violationTracker.clear();
    }
}

// Global singleton
const metrics = new PrometheusMetrics();

// Cleanup every 2 minutes
setInterval(() => metrics.cleanup(), 120000);

module.exports = metrics;

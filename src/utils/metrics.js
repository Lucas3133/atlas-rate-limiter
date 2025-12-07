// ================================================================
// ATLAS RATE LIMITER - PROMETHEUS METRICS (ADVANCED)
// ================================================================
// FEAT-001: Metrics for Grafana/Prometheus
// METRIC-ADV-001: Decoupled System Health vs Protection Rate
// SEC-ADV-001: Malicious client detection
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
        this.maliciousClients = new Set();  // SEC-ADV-001: Track malicious IPs

        // ============================================================
        // HISTOGRAMS (records last values)
        // ============================================================
        this.responseTimesMs = [];
        this.maxHistorySize = 1000; // Keep last 1000 measurements

        // SEC-ADV-001: Track violation counts per client (in-memory cache)
        // Format: { clientId: { count: number, firstViolation: timestamp } }
        this.violationTracker = new Map();
        this.MALICIOUS_THRESHOLD = 10;  // Blocks in 60s = malicious
        this.VIOLATION_WINDOW_MS = 60000; // 60 seconds
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
            if (clientId) {
                this.maliciousClients.add(clientId);
            }
        } else {
            this.blockedStandard++;
        }
    }

    /**
     * SEC-ADV-001: Track client violations and detect malicious behavior
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
                    this.maliciousClients.add(clientId);
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
     * Check if client is flagged as malicious
     * @param {string} clientId 
     * @returns {boolean}
     */
    isMaliciousClient(clientId) {
        return this.maliciousClients.has(clientId);
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
     * Records response time
     */
    recordResponseTime(timeMs) {
        this.responseTimesMs.push(timeMs);

        // Keep only last N measurements
        if (this.responseTimesMs.length > this.maxHistorySize) {
            this.responseTimesMs.shift();
        }
    }

    /**
     * Tracks active client
     */
    trackClient(clientId) {
        this.activeClients.add(clientId);
    }

    /**
     * Calculates percentile of a number array
     */
    percentile(arr, p) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * METRIC-ADV-001: Calculate System Health Score
     * Indicates infrastructure reliability (should be 100% ideally)
     * Formula: 100 - ((redis_errors + fail_open_events) / total_requests * 100)
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
     * Percentage of traffic being filtered/blocked by rate limiter
     */
    getProtectionRate() {
        const totalRequests = this.requestsAllowed + this.requestsBlocked;
        if (totalRequests === 0) return 0;
        return (this.requestsBlocked / totalRequests) * 100;
    }

    /**
     * UX-001: Get threat level based on protection rate and malicious activity
     * @returns {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'}
     */
    getThreatLevel() {
        const protectionRate = this.getProtectionRate();
        const maliciousCount = this.maliciousClients.size;

        if (maliciousCount >= 5 || protectionRate >= 50) {
            return 'CRITICAL';
        } else if (maliciousCount >= 2 || protectionRate >= 30) {
            return 'HIGH';
        } else if (maliciousCount >= 1 || protectionRate >= 10) {
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

            // SEC-ADV-001: Security metrics
            blockedStandard: this.blockedStandard,
            blockedMalicious: this.blockedMalicious,
            threatsNeutralized: this.threatsNeutralized,
            maliciousClients: this.maliciousClients.size,

            // Infrastructure
            redisErrors: this.redisErrors,
            failOpenEvents: this.failOpenEvents,
            activeClients: this.activeClients.size,

            // UX-001
            threatLevel: this.getThreatLevel()
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

        // SEC-ADV-001: Separate blocked counters
        lines.push('# HELP atlas_blocked_standard Standard rate limit blocks');
        lines.push('# TYPE atlas_blocked_standard counter');
        lines.push(`atlas_blocked_standard ${this.blockedStandard}`);
        lines.push('');

        lines.push('# HELP atlas_blocked_malicious Blocks from malicious clients');
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

        lines.push('# HELP atlas_fail_open_events_total Total fail-open events (allowed due to error)');
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

        // SEC-ADV-001: Malicious clients gauge
        lines.push('# HELP atlas_malicious_clients Number of clients flagged as malicious');
        lines.push('# TYPE atlas_malicious_clients gauge');
        lines.push(`atlas_malicious_clients ${this.maliciousClients.size}`);
        lines.push('');

        // METRIC-ADV-001: System Health Score
        const healthScore = this.getSystemHealthScore();
        lines.push('# HELP atlas_system_health_score Infrastructure reliability percentage (100 = perfect)');
        lines.push('# TYPE atlas_system_health_score gauge');
        lines.push(`atlas_system_health_score ${healthScore.toFixed(2)}`);
        lines.push('');

        // METRIC-ADV-001: Protection Rate
        const protectionRate = this.getProtectionRate();
        lines.push('# HELP atlas_protection_rate Percentage of traffic filtered by rate limiter');
        lines.push('# TYPE atlas_protection_rate gauge');
        lines.push(`atlas_protection_rate ${protectionRate.toFixed(2)}`);
        lines.push('');

        // Legacy: Block rate (for backwards compatibility)
        const totalRequests = this.requestsAllowed + this.requestsBlocked;
        const blockRate = totalRequests > 0
            ? ((this.requestsBlocked / totalRequests) * 100).toFixed(2)
            : 0;

        lines.push('# HELP atlas_block_rate_percent Percentage of blocked requests');
        lines.push('# TYPE atlas_block_rate_percent gauge');
        lines.push(`atlas_block_rate_percent ${blockRate}`);
        lines.push('');

        // ============================================================
        // HISTOGRAMS - Response Time
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
        lines.push(`atlas_info{version="1.1.0",arch="distributed"} 1`);

        return lines.join('\n');
    }

    /**
     * Cleanup expired violation trackers (call periodically)
     */
    cleanupViolationTracker() {
        const now = Date.now();
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
        this.maliciousClients.clear();
        this.responseTimesMs = [];
        this.violationTracker.clear();
    }
}

// Global singleton
const metrics = new PrometheusMetrics();

// Cleanup old violations every 2 minutes
setInterval(() => metrics.cleanupViolationTracker(), 120000);

module.exports = metrics;

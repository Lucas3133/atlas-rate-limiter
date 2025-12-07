// ================================================================
// ATLAS RATE LIMITER - PROMETHEUS METRICS
// ================================================================
// FEAT-001: Metrics for Grafana/Prometheus
// ================================================================

class PrometheusMetrics {
    constructor() {
        // Counters (values that only increment)
        this.requestsAllowed = 0;
        this.requestsBlocked = 0;
        this.redisErrors = 0;
        this.failOpenEvents = 0;

        // Gauges (values that can go up/down)
        this.activeClients = new Set();

        // Histograms (records last values)
        this.responseTimesMs = [];
        this.maxHistorySize = 1000; // Keep last 1000 measurements
    }

    /**
     * Increments allowed requests counter
     */
    incrementAllowed() {
        this.requestsAllowed++;
    }

    /**
     * Increments blocked requests counter
     */
    incrementBlocked() {
        this.requestsBlocked++;
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

        // Block rate (%)
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
        lines.push(`atlas_info{version="1.0.0-beta",arch="distributed"} 1`);

        return lines.join('\n');
    }

    /**
     * Resets metrics (useful for tests)
     */
    reset() {
        this.requestsAllowed = 0;
        this.requestsBlocked = 0;
        this.redisErrors = 0;
        this.failOpenEvents = 0;
        this.activeClients.clear();
        this.responseTimesMs = [];
    }
}

// Global singleton
const metrics = new PrometheusMetrics();

module.exports = metrics;

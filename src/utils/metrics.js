// ================================================================
// ATLAS RATE LIMITER - PROMETHEUS METRICS
// ================================================================
// FEAT-001: Métricas para Grafana/Prometheus
// ================================================================

class PrometheusMetrics {
    constructor() {
        // Counters (valores que só incrementam)
        this.requestsAllowed = 0;
        this.requestsBlocked = 0;
        this.redisErrors = 0;
        this.failOpenEvents = 0;

        // Gauges (valores que podem subir/descer)
        this.activeClients = new Set();

        // Histograms (registra últimos valores)
        this.responseTimesMs = [];
        this.maxHistorySize = 1000; // Manter últimas 1000 medições
    }

    /**
     * Incrementa contador de requisições permitidas
     */
    incrementAllowed() {
        this.requestsAllowed++;
    }

    /**
     * Incrementa contador de requisições bloqueadas
     */
    incrementBlocked() {
        this.requestsBlocked++;
    }

    /**
     * Incrementa contador de erros do Redis
     */
    incrementRedisError() {
        this.redisErrors++;
    }

    /**
     * Incrementa contador de eventos fail-open
     */
    incrementFailOpen() {
        this.failOpenEvents++;
    }

    /**
     * Registra tempo de resposta
     */
    recordResponseTime(timeMs) {
        this.responseTimesMs.push(timeMs);

        // Manter apenas últimas N medições
        if (this.responseTimesMs.length > this.maxHistorySize) {
            this.responseTimesMs.shift();
        }
    }

    /**
     * Rastreia cliente ativo
     */
    trackClient(clientId) {
        this.activeClients.add(clientId);
    }

    /**
     * Calcula percentil de um array de números
     */
    percentile(arr, p) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * Gera métricas no formato Prometheus
     */
    toPrometheus() {
        const lines = [];

        // ============================================================
        // COUNTERS
        // ============================================================
        lines.push('# HELP atlas_requests_allowed_total Total de requisições permitidas');
        lines.push('# TYPE atlas_requests_allowed_total counter');
        lines.push(`atlas_requests_allowed_total ${this.requestsAllowed}`);
        lines.push('');

        lines.push('# HELP atlas_requests_blocked_total Total de requisições bloqueadas (429)');
        lines.push('# TYPE atlas_requests_blocked_total counter');
        lines.push(`atlas_requests_blocked_total ${this.requestsBlocked}`);
        lines.push('');

        lines.push('# HELP atlas_redis_errors_total Total de erros de conexão Redis');
        lines.push('# TYPE atlas_redis_errors_total counter');
        lines.push(`atlas_redis_errors_total ${this.redisErrors}`);
        lines.push('');

        lines.push('# HELP atlas_fail_open_events_total Total de eventos fail-open (permitiu por erro)');
        lines.push('# TYPE atlas_fail_open_events_total counter');
        lines.push(`atlas_fail_open_events_total ${this.failOpenEvents}`);
        lines.push('');

        // ============================================================
        // GAUGES
        // ============================================================
        lines.push('# HELP atlas_active_clients Número de clientes únicos ativos');
        lines.push('# TYPE atlas_active_clients gauge');
        lines.push(`atlas_active_clients ${this.activeClients.size}`);
        lines.push('');

        // Taxa de bloqueio (%)
        const totalRequests = this.requestsAllowed + this.requestsBlocked;
        const blockRate = totalRequests > 0
            ? ((this.requestsBlocked / totalRequests) * 100).toFixed(2)
            : 0;

        lines.push('# HELP atlas_block_rate_percent Porcentagem de requisições bloqueadas');
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

            lines.push('# HELP atlas_response_time_ms Tempo de resposta do rate limiter');
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
        lines.push('# HELP atlas_info Informações do Atlas Rate Limiter');
        lines.push('# TYPE atlas_info gauge');
        lines.push(`atlas_info{version="1.0.0-beta",arch="distributed"} 1`);

        return lines.join('\n');
    }

    /**
     * Reseta métricas (útil para testes)
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

// Singleton global
const metrics = new PrometheusMetrics();

module.exports = metrics;

/**
 * Production Metrics Collector
 * Tracks application metrics for monitoring and observability
 */

const logger = require('./logger');

class MetricsCollector {
    constructor() {
        this.metrics = {
            leads: {
                total: 0,
                processing: 0,
                completed: 0,
                failed: 0
            },
            calls: {
                total: 0,
                active: 0,
                completed: 0,
                failed: 0,
                totalDuration: 0 // in seconds
            },
            requests: {
                total: 0,
                byEndpoint: {},
                byMethod: {},
                totalDuration: 0 // in milliseconds
            },
            system: {
                startTime: Date.now(),
                lastRestart: new Date().toISOString()
            }
        };
    }

    /**
     * Increment lead counter
     * @param {string} status - Lead status (processing, completed, failed)
     */
    incrementLead(status = 'processing') {
        this.metrics.leads.total++;
        if (this.metrics.leads[status] !== undefined) {
            this.metrics.leads[status]++;
        }
        logger.info('Lead metric incremented', { status, total: this.metrics.leads.total });
    }

    /**
     * Increment call counter
     * @param {string} status - Call status (active, completed, failed)
     * @param {number} duration - Call duration in seconds
     */
    incrementCall(status = 'active', duration = 0) {
        this.metrics.calls.total++;
        if (this.metrics.calls[status] !== undefined) {
            this.metrics.calls[status]++;
        }
        if (duration > 0) {
            this.metrics.calls.totalDuration += duration;
        }
        logger.info('Call metric incremented', { status, duration, total: this.metrics.calls.total });
    }

    /**
     * Track HTTP request
     * @param {string} method - HTTP method
     * @param {string} endpoint - Request endpoint
     * @param {number} duration - Request duration in milliseconds
     */
    trackRequest(method, endpoint, duration) {
        this.metrics.requests.total++;
        this.metrics.requests.totalDuration += duration;

        // Track by endpoint
        if (!this.metrics.requests.byEndpoint[endpoint]) {
            this.metrics.requests.byEndpoint[endpoint] = { count: 0, totalDuration: 0 };
        }
        this.metrics.requests.byEndpoint[endpoint].count++;
        this.metrics.requests.byEndpoint[endpoint].totalDuration += duration;

        // Track by method
        if (!this.metrics.requests.byMethod[method]) {
            this.metrics.requests.byMethod[method] = 0;
        }
        this.metrics.requests.byMethod[method]++;
    }

    /**
     * Get average call duration
     * @returns {number} - Average duration in seconds
     */
    getAverageCallDuration() {
        const completed = this.metrics.calls.completed + this.metrics.calls.failed;
        if (completed === 0) return 0;
        return (this.metrics.calls.totalDuration / completed).toFixed(2);
    }

    /**
     * Get average request duration
     * @returns {number} - Average duration in milliseconds
     */
    getAverageRequestDuration() {
        if (this.metrics.requests.total === 0) return 0;
        return (this.metrics.requests.totalDuration / this.metrics.requests.total).toFixed(2);
    }

    /**
     * Get uptime in seconds
     * @returns {number} - Uptime in seconds
     */
    getUptime() {
        return Math.floor((Date.now() - this.metrics.system.startTime) / 1000);
    }

    /**
     * Get all metrics
     * @returns {object} - Complete metrics object
     */
    getMetrics() {
        return {
            leads: this.metrics.leads,
            calls: {
                ...this.metrics.calls,
                averageDuration: parseFloat(this.getAverageCallDuration())
            },
            requests: {
                total: this.metrics.requests.total,
                averageDuration: parseFloat(this.getAverageRequestDuration()),
                byEndpoint: this.metrics.requests.byEndpoint,
                byMethod: this.metrics.requests.byMethod
            },
            system: {
                uptime: this.getUptime(),
                startTime: new Date(this.metrics.system.startTime).toISOString(),
                lastRestart: this.metrics.system.lastRestart
            }
        };
    }

    /**
     * Reset all metrics (for testing)
     */
    reset() {
        this.metrics.leads = { total: 0, processing: 0, completed: 0, failed: 0 };
        this.metrics.calls = { total: 0, active: 0, completed: 0, failed: 0, totalDuration: 0 };
        this.metrics.requests = { total: 0, byEndpoint: {}, byMethod: {}, totalDuration: 0 };
        this.metrics.system.startTime = Date.now();
        this.metrics.system.lastRestart = new Date().toISOString();
        logger.info('Metrics reset');
    }
}

// Export singleton instance
module.exports = new MetricsCollector();

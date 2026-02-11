/**
 * Call Timeout Module
 * Enforces a maximum call duration (default 90 seconds).
 * Gracefully ends the call and triggers summary generation.
 */

const config = require('../../config/config.json');

const DEFAULT_MAX_SECONDS = config.call.maxDurationSeconds || 90;

class CallTimeout {
    /**
     * @param {number} maxSeconds - Maximum call duration
     */
    constructor(maxSeconds = DEFAULT_MAX_SECONDS) {
        this.maxSeconds = maxSeconds;
        this.startTime = null;
        this.timer = null;
        this.timedOut = false;
        this._onTimeout = null;
    }

    /**
     * Start the timeout clock.
     * @param {Function} onTimeout - Callback when timeout fires
     */
    start(onTimeout) {
        this.startTime = Date.now();
        this._onTimeout = onTimeout;

        this.timer = setTimeout(() => {
            this.timedOut = true;
            console.warn(`[CallTimeout] Call exceeded ${this.maxSeconds}s limit.`);
            if (this._onTimeout) this._onTimeout();
        }, this.maxSeconds * 1000);
    }

    /**
     * Stop the timeout clock.
     */
    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * Get elapsed time in seconds.
     * @returns {number}
     */
    getElapsedSeconds() {
        if (!this.startTime) return 0;
        return (Date.now() - this.startTime) / 1000;
    }

    /**
     * Get remaining time in seconds.
     * @returns {number}
     */
    getRemainingSeconds() {
        return Math.max(0, this.maxSeconds - this.getElapsedSeconds());
    }

    /**
     * Check if the call has timed out.
     * @returns {boolean}
     */
    hasTimedOut() {
        return this.timedOut;
    }

    /**
     * Check if we're in the last 15 seconds (should start wrapping up).
     * @returns {boolean}
     */
    shouldWrapUp() {
        return this.getRemainingSeconds() <= 15;
    }
}

module.exports = { CallTimeout };

/**
 * State Path Tracker
 * Records the sequence of states visited during a call.
 * Stores in memory + writes to SQLite.
 */

const db = require('../utils/db');

class StatePathTracker {
    /**
     * @param {string} leadId
     */
    constructor(leadId) {
        this.leadId = leadId;
        /** @type {Array<{state: string, timestamp: string}>} */
        this.path = [];
    }

    /**
     * Record a state transition.
     * @param {string} state
     */
    record(state) {
        const entry = {
            state,
            timestamp: new Date().toISOString(),
        };
        this.path.push(entry);

        // Persist to SQLite
        try {
            db.insertCallPath(this.leadId, state);
        } catch (error) {
            console.error(`[PathTracker] DB write failed:`, error.message);
        }
    }

    /**
     * Get the full path array.
     * @returns {string[]}
     */
    getPath() {
        return this.path.map(p => p.state);
    }

    /**
     * Get detailed path with timestamps.
     * @returns {Array<{state: string, timestamp: string}>}
     */
    getDetailedPath() {
        return [...this.path];
    }

    /**
     * Get previous state (before current).
     * @returns {string|null}
     */
    getPreviousState() {
        if (this.path.length < 2) return null;
        return this.path[this.path.length - 2].state;
    }

    /**
     * Count how many times a specific state was visited.
     * @param {string} state
     * @returns {number}
     */
    countVisits(state) {
        return this.path.filter(p => p.state === state).length;
    }
}

module.exports = { StatePathTracker };

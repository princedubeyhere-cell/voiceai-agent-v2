/**
 * Memory Manager
 * Maintains a sliding window of conversation history (last N turns).
 * Prevents context bloat and LLM confusion in long calls.
 */

const config = require('../../config/config.json');

const MAX_TURNS = config.call.memoryWindowTurns || 6;

class MemoryManager {
    constructor() {
        /** @type {Array<{role: string, content: string}>} */
        this.fullHistory = [];
        this.turnCount = 0;
    }

    /**
     * Add a message to conversation history.
     * @param {string} role - 'user' | 'assistant'
     * @param {string} content
     */
    addMessage(role, content) {
        this.fullHistory.push({ role, content });
        if (role === 'user') this.turnCount++;
    }

    /**
     * Get the pruned conversation window for LLM context.
     * Returns only the last MAX_TURNS * 2 messages (user + assistant pairs).
     * @returns {Array<{role: string, content: string}>}
     */
    getWindow() {
        const maxMessages = MAX_TURNS * 2; // Each turn = user + assistant
        if (this.fullHistory.length <= maxMessages) {
            return [...this.fullHistory];
        }

        // Keep the first exchange (opening) + last N turns
        const opening = this.fullHistory.slice(0, 2);
        const recent = this.fullHistory.slice(-maxMessages + 2);

        return [
            ...opening,
            { role: 'system', content: `[Earlier conversation of ${this.fullHistory.length - maxMessages} messages summarized for context]` },
            ...recent,
        ];
    }

    /**
     * Get full unfiltered history (for logging/summary).
     * @returns {Array<{role: string, content: string}>}
     */
    getFullHistory() {
        return [...this.fullHistory];
    }

    /**
     * Get the total number of user turns.
     * @returns {number}
     */
    getTurnCount() {
        return this.turnCount;
    }

    /**
     * Clear all history.
     */
    reset() {
        this.fullHistory = [];
        this.turnCount = 0;
    }
}

module.exports = { MemoryManager };

/**
 * Fallback Handler — 3-Level Escalation
 * Works with the interrupt handler for cooperative fallback management.
 */

class FallbackHandler {
    /**
     * @param {Object} fallbackConfig - Client's fallback.json data
     */
    constructor(fallbackConfig = {}) {
        this.config = fallbackConfig;
        this.count = 0;
        this.maxLevel = 3;
    }

    /**
     * Get the current fallback level (0 = no fallback needed).
     * @returns {number}
     */
    getLevel() {
        return Math.min(this.count, this.maxLevel);
    }

    /**
     * Trigger a fallback and get the appropriate instruction.
     * @returns {{ level: number, instruction: string, shouldEnd: boolean }}
     */
    trigger() {
        this.count++;
        const level = this.getLevel();

        switch (level) {
            case 1:
                return {
                    level: 1,
                    instruction: this.config.level1 || 'Attempt a general helpful answer within industry context.',
                    shouldEnd: false,
                };
            case 2:
                return {
                    level: 2,
                    instruction: this.config.level2 || 'Redirect conversation back to core services.',
                    shouldEnd: false,
                };
            case 3:
            default:
                return {
                    level: 3,
                    instruction: this.config.level3 || "Say: 'I'll note this down and have someone from the team call you back shortly.'",
                    shouldEnd: true,
                };
        }
    }

    /**
     * Get the fallback count.
     * @returns {number}
     */
    getCount() {
        return this.count;
    }

    /**
     * Force trigger level 3 (safe exit).
     * Used by interrupt handler when user is frustrated.
     * @returns {{ level: number, instruction: string, shouldEnd: boolean }}
     */
    forceSafeExit() {
        this.count = this.maxLevel;
        return {
            level: 3,
            instruction: this.config.level3 || "Say: 'I'll note this down and have someone from the team call you back shortly.'",
            shouldEnd: true,
        };
    }

    /**
     * Reset fallback counter (e.g., when conversation returns to normal).
     */
    reset() {
        this.count = 0;
    }
}

module.exports = { FallbackHandler };

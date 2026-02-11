/**
 * Interrupt Handler
 * Detects topic switches, user interruptions, and excessive topic jumps.
 * Adjusts state machine and triggers fallback when needed.
 */

class InterruptHandler {
    constructor() {
        this.interruptCount = 0;
        this.previousTopics = [];
        this.maxInterruptsBeforeFallback = 5;
    }

    /**
     * Analyze user input for signs of interruption or topic switch.
     * @param {string} userMessage - Current user message
     * @param {string} previousAgentMessage - Last agent message
     * @param {string} currentState - Current call state
     * @returns {{ isInterrupt: boolean, type: string, shouldFallback: boolean }}
     */
    analyze(userMessage, previousAgentMessage, currentState) {
        const msg = userMessage.toLowerCase().trim();

        // Detect explicit interruptions
        const interruptPhrases = [
            'hold on', 'stop talking', 'no no no', 'that\'s not what i',
            'forget that', 'never mind', 'let me stop you',
            'can i ask something else', 'change of topic',
            'completely different', 'different question entirely',
        ];

        const isExplicitInterrupt = interruptPhrases.some(p => msg.includes(p));

        // Detect topic switch by checking if message has no relation to previous context
        const isTopicSwitch = this._detectTopicSwitch(msg, previousAgentMessage);

        // Detect frustration
        const frustrationPhrases = [
            'this is useless', 'waste of time', 'not helpful',
            'i want to talk to a human', 'real person', 'manager',
            'supervisor', 'complaint',
        ];
        const isFrustrated = frustrationPhrases.some(p => msg.includes(p));

        const isInterrupt = isExplicitInterrupt || isTopicSwitch || isFrustrated;

        if (isInterrupt) {
            this.interruptCount++;
        }

        const type = isFrustrated ? 'frustration'
            : isExplicitInterrupt ? 'explicit_interrupt'
                : isTopicSwitch ? 'topic_switch'
                    : 'none';

        return {
            isInterrupt,
            type,
            shouldFallback: this.interruptCount >= this.maxInterruptsBeforeFallback || isFrustrated,
        };
    }

    /**
     * Simple topic switch detection.
     * @param {string} userMsg
     * @param {string} agentMsg
     * @returns {boolean}
     */
    _detectTopicSwitch(userMsg, agentMsg) {
        if (!agentMsg) return false;
        // Only detect as topic switch if user asks about completely unrelated subjects
        const offTopicPatterns = [
            /what('s| is) the weather/i,
            /stock market/i,
            /politics/i,
            /tell me a joke/i,
            /who is the president/i,
            /what time is it/i,
        ];
        return offTopicPatterns.some(p => p.test(userMsg));
    }

    /**
     * Get interrupt statistics.
     * @returns {{ count: number }}
     */
    getStats() {
        return { count: this.interruptCount };
    }

    /**
     * Reset counters.
     */
    reset() {
        this.interruptCount = 0;
        this.previousTopics = [];
    }
}

module.exports = { InterruptHandler };

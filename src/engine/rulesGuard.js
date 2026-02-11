/**
 * Rules Guard — Forbidden Response Filter
 * Prevents sensitive content, medical/legal guarantees, hallucinations.
 * Checks agent replies BEFORE they are sent to the user.
 */

class RulesGuard {
    /**
     * @param {Object} constraints - Client-specific constraints
     */
    constructor(constraints = {}) {
        this.constraints = constraints;

        // Universal forbidden patterns
        this.universalForbidden = [
            /i (guarantee|promise|assure you)/i,
            /you will (definitely|certainly|surely) (get|receive|have)/i,
            /100% (guaranteed|certain|sure)/i,
            /take this (medicine|medication|drug|pill)/i,
            /you should (sue|file a lawsuit|take legal action)/i,
            /invest .* guaranteed returns/i,
            /i am (a doctor|a lawyer|a financial advisor)/i,
            /this is (medical|legal|financial) advice/i,
        ];
    }

    /**
     * Check an agent reply for forbidden content.
     * @param {string} agentReply
     * @returns {{ safe: boolean, violations: string[], sanitizedReply: string }}
     */
    check(agentReply) {
        const violations = [];

        // Check universal forbidden patterns
        for (const pattern of this.universalForbidden) {
            if (pattern.test(agentReply)) {
                violations.push(`Universal rule violated: ${pattern.source}`);
            }
        }

        // Check client-specific forbidden topics
        if (this.constraints.forbidden_topics) {
            for (const topic of this.constraints.forbidden_topics) {
                if (agentReply.toLowerCase().includes(topic.toLowerCase())) {
                    violations.push(`Forbidden topic mentioned: "${topic}"`);
                }
            }
        }

        // Check client-specific forbidden actions
        if (this.constraints.forbidden_actions) {
            for (const action of this.constraints.forbidden_actions) {
                if (agentReply.toLowerCase().includes(action.toLowerCase())) {
                    violations.push(`Forbidden action mentioned: "${action}"`);
                }
            }
        }

        if (violations.length > 0) {
            console.warn(`[RulesGuard] Violations detected:`, violations);
            return {
                safe: false,
                violations,
                sanitizedReply: "I appreciate your question. Let me make sure I connect you with the right person from our team who can help you better with this. Can I note down your details?",
            };
        }

        return { safe: true, violations: [], sanitizedReply: agentReply };
    }
}

module.exports = { RulesGuard };

/**
 * Call State Machine (FSM)
 * States: OPENING → QUALIFICATION → OBJECTION → CLOSING → FALLBACK → ENDED
 * Manages transitions with validation.
 */

const STATES = {
    OPENING: 'OPENING',
    QUALIFICATION: 'QUALIFICATION',
    OBJECTION: 'OBJECTION',
    CLOSING: 'CLOSING',
    FALLBACK: 'FALLBACK',
    ENDED: 'ENDED',
};

// Valid state transitions
const TRANSITIONS = {
    [STATES.OPENING]: [STATES.QUALIFICATION, STATES.FALLBACK, STATES.ENDED],
    [STATES.QUALIFICATION]: [STATES.OBJECTION, STATES.CLOSING, STATES.FALLBACK, STATES.ENDED],
    [STATES.OBJECTION]: [STATES.QUALIFICATION, STATES.CLOSING, STATES.FALLBACK, STATES.ENDED],
    [STATES.CLOSING]: [STATES.ENDED, STATES.FALLBACK],
    [STATES.FALLBACK]: [STATES.QUALIFICATION, STATES.OBJECTION, STATES.CLOSING, STATES.ENDED],
    [STATES.ENDED]: [],
};

class CallStateMachine {
    constructor() {
        this.currentState = STATES.OPENING;
        this.stateErrors = 0;
    }

    /**
     * Get the current state.
     * @returns {string}
     */
    getState() {
        return this.currentState;
    }

    /**
     * Attempt a state transition.
     * @param {string} targetState
     * @returns {boolean} - Whether the transition was valid
     */
    transition(targetState) {
        if (!STATES[targetState]) {
            console.error(`[StateMachine] Invalid state: ${targetState}`);
            this.stateErrors++;
            return false;
        }

        const allowed = TRANSITIONS[this.currentState] || [];
        if (!allowed.includes(targetState)) {
            console.warn(
                `[StateMachine] Invalid transition: ${this.currentState} → ${targetState}. ` +
                `Allowed: [${allowed.join(', ')}]`
            );
            this.stateErrors++;
            return false;
        }

        this.currentState = targetState;
        return true;
    }

    /**
     * Force a state (for fallback / emergency).
     * @param {string} state
     */
    forceState(state) {
        if (STATES[state]) {
            this.currentState = state;
        }
    }

    /**
     * Check if the call has ended.
     * @returns {boolean}
     */
    isEnded() {
        return this.currentState === STATES.ENDED;
    }

    /**
     * Get count of invalid transition attempts.
     * @returns {number}
     */
    getStateErrors() {
        return this.stateErrors;
    }

    /**
     * Determine the next logical state based on conversation context.
     * Used by the call agent to auto-advance the flow.
     * @param {string} agentReply - The LLM's latest reply
     * @param {number} turnCount - Current turn number
     * @param {number} fallbackCount - Times fallback was triggered
     * @returns {string} - Suggested next state
     */
    suggestNextState(agentReply, turnCount, fallbackCount) {
        const reply = agentReply.toLowerCase();

        if (reply.includes('thank you for your time') || reply.includes('goodbye') || reply.includes('have a great day')) {
            return STATES.CLOSING;
        }
        if (reply.includes("i'll note this") || reply.includes('someone from the team') || reply.includes('call you back')) {
            return STATES.FALLBACK;
        }
        if (fallbackCount >= 3) {
            return STATES.ENDED;
        }
        if (this.currentState === STATES.OPENING && turnCount >= 1) {
            return STATES.QUALIFICATION;
        }
        if (reply.includes('understand your concern') || reply.includes('i see what you mean')) {
            return STATES.OBJECTION;
        }

        return this.currentState;
    }
}

module.exports = { CallStateMachine, STATES };

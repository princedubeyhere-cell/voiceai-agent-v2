/**
 * Call Agent — Main Orchestrator
 * Ties together all engine modules, persona, and OpenAI pipeline.
 * Manages the full lifecycle of a call from start to summary.
 */

const { loadClientProfile } = require('./personaManager');
const { FallbackHandler } = require('./fallback');
const { buildMasterPrompt } = require('../engine/masterPromptBuilder');
const { MemoryManager } = require('../engine/memoryManager');
const { CallStateMachine, STATES } = require('../engine/callStateMachine');
const { StatePathTracker } = require('../engine/statePathTracker');
const { InterruptHandler } = require('../engine/interruptHandler');
const { RulesGuard } = require('../engine/rulesGuard');
const { CallTimeout } = require('../engine/callTimeout');
const { scoreCall } = require('../engine/qualityScorer');
const { generateReply, generateSummary } = require('../openai/llm');
const { synthesize } = require('../openai/tts');
const { safeExecute } = require('../utils/errorHandler');
const db = require('../utils/db');
const logger = require('../logs/logger');

class CallAgent {
    /**
     * @param {string} leadId - Unique lead ID
     * @param {Object} leadInfo - Lead details { name, phone, email, ... }
     * @param {string} clientId - Client ID to load profile for
     */
    constructor(leadId, leadInfo, clientId) {
        this.leadId = leadId;
        this.leadInfo = leadInfo;
        this.clientId = clientId;
        this.clientConfig = null;

        // Engine modules (initialized in init())
        this.memory = new MemoryManager();
        this.stateMachine = new CallStateMachine();
        this.pathTracker = new StatePathTracker(leadId);
        this.interruptHandler = new InterruptHandler();
        this.fallback = null;
        this.rulesGuard = null;
        this.callTimeout = new CallTimeout();

        this.lastAgentMessage = '';
        this.audioFiles = [];
        this.initialized = false;
    }

    /**
     * Initialize the agent — load client profile and set up all modules.
     * @returns {boolean} - Whether init was successful
     */
    async init() {
        this.clientConfig = loadClientProfile(this.clientId);
        if (!this.clientConfig) {
            console.error(`[CallAgent] Failed to load client ${this.clientId}`);
            return false;
        }

        this.fallback = new FallbackHandler(this.clientConfig.fallback);
        this.rulesGuard = new RulesGuard(this.clientConfig.constraints);

        // Record initial state
        this.pathTracker.record(STATES.OPENING);

        // Log call start
        logger.logEvent(this.leadId, 'call_started', {
            clientId: this.clientId,
            industry: this.clientConfig.profile.industry,
        });

        this.initialized = true;
        console.log(`[CallAgent] Initialized for lead ${this.leadId} (client: ${this.clientId})`);
        return true;
    }

    /**
     * Get the opening greeting.
     * @returns {string}
     */
    getGreeting() {
        const greeting = this.clientConfig.script.opening
            || this.clientConfig.profile.greeting
            || `Hello! This is ${this.clientConfig.profile.name}. How can I help you today?`;

        this.memory.addMessage('assistant', greeting);
        this.lastAgentMessage = greeting;

        logger.logMessage(this.leadId, 'agent', greeting, STATES.OPENING);
        db.insertCallLog(this.leadId, 'agent', greeting, STATES.OPENING);

        // Generate TTS audio for greeting
        const voice = this.clientConfig.profile.voice || 'nova';
        safeExecute(async () => {
            const audio = await synthesize(greeting, voice);
            this.audioFiles.push({ state: STATES.OPENING, ...audio });
            logger.logEvent(this.leadId, 'tts_generated', { filename: audio.filename, state: STATES.OPENING });
        }, null, 'tts-greeting');

        return greeting;
    }

    /**
     * Process a user message and generate an agent response.
     * This is the main turn-by-turn handler.
     * @param {string} userMessage
     * @returns {Promise<{ reply: string, state: string, ended: boolean }>}
     */
    async processTurn(userMessage) {
        if (!this.initialized) {
            throw new Error('[CallAgent] Agent not initialized. Call init() first.');
        }

        if (this.stateMachine.isEnded() || this.callTimeout.hasTimedOut()) {
            return { reply: '', state: STATES.ENDED, ended: true };
        }

        // Log user message
        const currentState = this.stateMachine.getState();
        this.memory.addMessage('user', userMessage);
        logger.logMessage(this.leadId, 'user', userMessage, currentState);
        db.insertCallLog(this.leadId, 'user', userMessage, currentState);

        // ── Check for interrupts ───────────────────────────────────────────
        const interrupt = this.interruptHandler.analyze(
            userMessage, this.lastAgentMessage, currentState
        );

        if (interrupt.shouldFallback) {
            const fb = this.fallback.forceSafeExit();
            this.stateMachine.forceState(STATES.ENDED);
            this.pathTracker.record(STATES.FALLBACK);
            this.pathTracker.record(STATES.ENDED);

            const exitReply = this.clientConfig.fallback.level3
                || "I understand. I'll note everything down and have someone from our team call you back shortly. Thank you for your time.";

            logger.logMessage(this.leadId, 'agent', exitReply, STATES.FALLBACK);
            db.insertCallLog(this.leadId, 'agent', exitReply, STATES.FALLBACK);

            return { reply: exitReply, state: STATES.ENDED, ended: true };
        }

        if (interrupt.isInterrupt) {
            logger.logEvent(this.leadId, 'interrupt_detected', { type: interrupt.type });
        }

        // ── Check call timeout ─────────────────────────────────────────────
        if (this.callTimeout.shouldWrapUp()) {
            this.stateMachine.forceState(STATES.CLOSING);
            this.pathTracker.record(STATES.CLOSING);
        }

        // ── Build prompt and get LLM reply ─────────────────────────────────
        const masterPrompt = buildMasterPrompt({
            profile: this.clientConfig.profile,
            faqs: this.clientConfig.faqs,
            script: this.clientConfig.script,
            fallback: this.clientConfig.fallback,
            constraints: this.clientConfig.constraints,
            currentState: this.stateMachine.getState(),
            leadInfo: this.leadInfo,
        });

        let reply;
        try {
            reply = await generateReply(
                masterPrompt,
                this.memory.getWindow(),
                userMessage
            );
        } catch (error) {
            console.error(`[CallAgent] LLM error:`, error.message);
            const fb = this.fallback.trigger();
            reply = "I apologize, I'm having a brief technical issue. Could you please repeat that?";
            if (fb.shouldEnd) {
                reply = this.clientConfig.fallback.level3
                    || "I'll have someone from our team call you back shortly. Thank you.";
                this.stateMachine.forceState(STATES.ENDED);
            }
        }

        // ── Run rules guard ────────────────────────────────────────────────
        const guardResult = this.rulesGuard.check(reply);
        if (!guardResult.safe) {
            logger.logEvent(this.leadId, 'guard_violation', { violations: guardResult.violations });
            reply = guardResult.sanitizedReply;

            // Count guard violations as fallback triggers
            this.fallback.trigger();
        }

        // ── Update state machine ───────────────────────────────────────────
        const suggestedState = this.stateMachine.suggestNextState(
            reply,
            this.memory.getTurnCount(),
            this.fallback.getCount()
        );

        if (suggestedState !== this.stateMachine.getState()) {
            const transitioned = this.stateMachine.transition(suggestedState);
            if (transitioned) {
                this.pathTracker.record(suggestedState);
            }
        }

        // ── Store agent reply ──────────────────────────────────────────────
        const newState = this.stateMachine.getState();
        this.memory.addMessage('assistant', reply);
        this.lastAgentMessage = reply;

        logger.logMessage(this.leadId, 'agent', reply, newState);
        db.insertCallLog(this.leadId, 'agent', reply, newState);

        // Generate TTS audio for agent reply
        const voice = this.clientConfig.profile.voice || 'nova';
        try {
            const audio = await synthesize(reply, voice);
            this.audioFiles.push({ state: newState, ...audio });
            logger.logEvent(this.leadId, 'tts_generated', { filename: audio.filename, state: newState });
        } catch (ttsErr) {
            console.error(`[CallAgent] TTS failed for turn: ${ttsErr.message}`);
        }

        const ended = this.stateMachine.isEnded();
        return { reply, state: newState, ended };
    }

    /**
     * End the call and generate summary + quality score.
     * Call this after the conversation loop ends.
     * @returns {Promise<Object>} - { summary, qualityScore }
     */
    async endCall() {
        this.callTimeout.stop();

        if (!this.stateMachine.isEnded()) {
            this.stateMachine.forceState(STATES.ENDED);
            this.pathTracker.record(STATES.ENDED);
        }

        const callDuration = this.callTimeout.getElapsedSeconds();

        // ── Generate summary ───────────────────────────────────────────────
        let summary = {};
        try {
            summary = await generateSummary(
                this.clientConfig.profile.industry,
                this.memory.getFullHistory()
            );
        } catch (error) {
            console.error('[CallAgent] Summary generation failed:', error.message);
            summary = {
                qualification: 'needs_followup',
                budget: 'not_discussed',
                requirement: 'Summary generation failed',
                sentiment: 'neutral',
                nextAction: 'Manual review',
                summary: 'Auto-summary could not be generated.',
            };
        }

        // ── Store outcome in DB ────────────────────────────────────────────
        await safeExecute(() => {
            db.upsertOutcome({
                leadId: this.leadId,
                clientId: this.clientId,
                qualification: summary.qualification,
                budget: summary.budget,
                requirement: summary.requirement,
                sentiment: summary.sentiment,
                nextAction: summary.nextAction,
                summary: summary.summary,
                callDuration,
                totalTurns: this.memory.getTurnCount(),
                fallbacksUsed: this.fallback.getCount(),
            });
            db.updateLeadStatus(this.leadId, 'completed');
        }, null, 'save-outcome');

        // ── Log summary ────────────────────────────────────────────────────
        logger.logSummary(this.leadId, {
            ...summary,
            callDuration,
            totalTurns: this.memory.getTurnCount(),
            statePath: this.pathTracker.getPath(),
            fallbacksUsed: this.fallback.getCount(),
            interrupts: this.interruptHandler.getStats().count,
        });

        // ── Quality score ──────────────────────────────────────────────────
        const qualityScore = scoreCall({
            leadId: this.leadId,
            fallbackCount: this.fallback.getCount(),
            interruptCount: this.interruptHandler.getStats().count,
            stateErrors: this.stateMachine.getStateErrors(),
            callLengthSeconds: callDuration,
            completedFlow: this.pathTracker.getPath().includes(STATES.CLOSING),
            sentiment: summary.sentiment,
        });

        logger.logEvent(this.leadId, 'call_ended', {
            duration: callDuration,
            turns: this.memory.getTurnCount(),
            qualityScore: qualityScore.score,
        });

        console.log(`[CallAgent] Call ended for lead ${this.leadId}. Score: ${qualityScore.score}/10`);

        return { summary, qualityScore };
    }

    /**
     * Start the call timeout clock.
     * @param {Function} onTimeout - Called when timeout fires
     */
    startTimeout(onTimeout) {
        this.callTimeout.start(onTimeout || (() => {
            console.warn(`[CallAgent] Call timeout for lead ${this.leadId}`);
        }));
    }
}

module.exports = { CallAgent };

/**
 * Lead Processor
 * Validates lead → saves to SQLite → resolves client → triggers call agent.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { clientExists } = require('../agents/personaManager');
const { CallAgent } = require('../agents/callAgent');
const { createSimulatorAdapter } = require('../engine/inputAdapter');
const logger = require('../logs/logger');
const { safeExecute } = require('../utils/errorHandler');

/**
 * Process an incoming lead and trigger a simulated call.
 * @param {Object} leadData - { clientId, name, phone, email, budget, requirement, notes }
 * @returns {Promise<Object>} - { leadId, status, summary?, qualityScore? }
 */
async function processLead(leadData) {
    const leadId = uuidv4();

    // ── Validate client exists ─────────────────────────────────────────
    if (!clientExists(leadData.clientId)) {
        throw Object.assign(
            new Error(`Client "${leadData.clientId}" not found.`),
            { status: 404, code: 'CLIENT_NOT_FOUND' }
        );
    }

    // ── Save lead to database ──────────────────────────────────────────
    db.insertLead({
        id: leadId,
        clientId: leadData.clientId,
        name: leadData.name,
        phone: leadData.phone,
        email: leadData.email || '',
        budget: leadData.budget || '',
        requirement: leadData.requirement || '',
        notes: leadData.notes || '',
        status: 'processing',
    });

    logger.logEvent(leadId, 'lead_received', {
        clientId: leadData.clientId,
        name: leadData.name,
    });

    // ── Initialize Call Agent ──────────────────────────────────────────
    const agent = new CallAgent(leadId, leadData, leadData.clientId);
    const initOk = await agent.init();

    if (!initOk) {
        db.updateLeadStatus(leadId, 'failed');
        throw Object.assign(
            new Error(`Failed to initialize call agent for client "${leadData.clientId}".`),
            { status: 500, code: 'AGENT_INIT_FAILED' }
        );
    }

    // ── Run simulated call (async) ─────────────────────────────────────
    // In production, this would be replaced by a real telephony trigger.
    // For now, run a quick simulated exchange.
    runSimulatedCall(agent, leadData).catch(err => {
        console.error(`[LeadProcessor] Simulated call error for ${leadId}:`, err.message);
        safeExecute(() => db.updateLeadStatus(leadId, 'error'), null, 'update-lead-status');
    });

    return {
        leadId,
        status: 'processing',
        message: `Lead accepted. Call initiated for client "${leadData.clientId}".`,
    };
}

/**
 * Run a simulated call with scripted user inputs.
 * @param {CallAgent} agent
 * @param {Object} leadData
 */
async function runSimulatedCall(agent, leadData) {
    // Scripted user responses for simulation
    const simulatedUserResponses = [
        `Hi, yes I was looking for some help. My name is ${leadData.name}.`,
        leadData.requirement || "I'm interested in what you offer. Can you tell me more?",
        leadData.budget ? `My budget is around ${leadData.budget}.` : "I'm flexible on budget, what do you suggest?",
        "That sounds good. What are the next steps?",
        "Okay, thank you. I'll think about it and get back to you.",
    ];

    // Start timeout
    agent.startTimeout();

    // Get greeting
    const greeting = agent.getGreeting();
    console.log(`[SimCall] Agent: ${greeting}`);

    // Turn-by-turn loop
    for (const userMsg of simulatedUserResponses) {
        const result = await agent.processTurn(userMsg);
        console.log(`[SimCall] Agent: ${result.reply}`);

        if (result.ended) break;
    }

    // End call and generate summary
    const { summary, qualityScore } = await agent.endCall();
    console.log(`[SimCall] Call ended. Summary:`, summary);
    console.log(`[SimCall] Quality Score: ${qualityScore.score}/10`);
}

module.exports = { processLead };

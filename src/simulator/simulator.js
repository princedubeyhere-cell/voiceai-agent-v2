/**
 * VoiceAI Call Simulator
 * Runs a full end-to-end simulated call against any client profile.
 * Usage: node src/simulator/simulator.js [clientId]
 *
 * Defaults to "travel-agency-01" if no client specified.
 */

const { CallAgent } = require('../agents/callAgent');
const { clientExists, listClients } = require('../agents/personaManager');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

// ── Configuration ──────────────────────────────────────────────────────

const clientId = process.argv[2] || 'travel-agency-01';

// Scripted conversations per industry (simulating different caller types)
const SCENARIOS = {
    'travel-agency-01': {
        lead: {
            name: 'Rahul Sharma',
            phone: '+91-9876543210',
            email: 'rahul@example.com',
            requirement: 'Looking for a Bali trip for 2 people',
            budget: '$2000',
        },
        userMessages: [
            "Hi, yes I'm interested in a trip to Bali.",
            "It would be for me and my wife, for about 5 days.",
            "We're thinking sometime in March or April.",
            "Our budget is around $2000 for both of us. Is that enough?",
            "Do you handle visa and everything?",
            "That sounds great! Can you send me the itinerary?",
            "Okay thank you, I'll discuss with my wife and get back to you.",
        ],
    },

    'doctor-clinic-01': {
        lead: {
            name: 'Priya Patel',
            phone: '+91-9988776655',
            email: 'priya@example.com',
            requirement: 'Persistent back pain for 2 weeks',
            budget: '',
        },
        userMessages: [
            "Hi, I've been having back pain for the last two weeks.",
            "No, I haven't seen a doctor yet. It started after I lifted something heavy.",
            "I'd prefer an orthopedic specialist.",
            "Is this Saturday morning available?",
            "Do you accept Star Health insurance?",
            "Okay, please book me for Saturday morning then.",
            "Thank you, bye.",
        ],
    },

    'coaching-seller-01': {
        lead: {
            name: 'Amit Kumar',
            phone: '+91-9112233445',
            email: 'amit@example.com',
            requirement: 'Want to learn Full-Stack Development',
            budget: '$800',
        },
        userMessages: [
            "Hi, I'm interested in learning full-stack development.",
            "I'm currently working as a data entry operator but want to switch to tech.",
            "I have very basic knowledge of HTML only.",
            "My budget is around $800. Do you have any options?",
            "How long will it take to complete?",
            "And you help with job placement too?",
            "Sounds good! When does the next batch start?",
            "Okay, please send me the details. Thank you!",
        ],
    },
};

// Interrupt scenario (tests fallback + interrupt handling)
const INTERRUPT_SCENARIO = {
    lead: {
        name: 'Test User',
        phone: '+91-0000000000',
        email: 'test@test.com',
        requirement: 'Testing interrupts',
        budget: '',
    },
    userMessages: [
        "Hi there.",
        "Wait, can I ask something completely different?",
        "What's the weather like tomorrow?",
        "Actually forget that, can you tell me about stock markets?",
        "This isn't helpful at all. I want to talk to a real person.",
    ],
};

// ── Main Simulation ────────────────────────────────────────────────────

async function runSimulation() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       🎙️  VoiceAI Call Simulator — STARTING         ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    // Check client exists
    if (!clientExists(clientId)) {
        console.error(`❌ Client "${clientId}" not found.`);
        console.log('Available clients:', listClients().join(', '));
        process.exit(1);
    }

    // Get scenario
    const scenario = SCENARIOS[clientId] || INTERRUPT_SCENARIO;
    const leadId = uuidv4();

    console.log(`📋 Client: ${clientId}`);
    console.log(`👤 Lead: ${scenario.lead.name} (${leadId})`);
    console.log(`📞 Starting simulated call...`);
    console.log('─'.repeat(55));

    // Save lead to DB
    db.insertLead({
        id: leadId,
        clientId,
        name: scenario.lead.name,
        phone: scenario.lead.phone,
        email: scenario.lead.email,
        budget: scenario.lead.budget,
        requirement: scenario.lead.requirement,
        notes: '',
        status: 'simulating',
    });

    // Initialize agent
    const agent = new CallAgent(leadId, scenario.lead, clientId);
    const initOk = await agent.init();

    if (!initOk) {
        console.error('❌ Failed to initialize call agent.');
        process.exit(1);
    }

    // Start timeout
    agent.startTimeout();

    // Opening greeting
    const greeting = agent.getGreeting();
    console.log(`\n🤖 Agent: ${greeting}\n`);

    // Conversation loop
    for (const userMsg of scenario.userMessages) {
        console.log(`👤 User: ${userMsg}`);

        try {
            const result = await agent.processTurn(userMsg);
            console.log(`🤖 Agent: ${result.reply}`);
            console.log(`   [State: ${result.state}]`);

            if (result.ended) {
                console.log('\n⏹️  Call ended by agent.');
                break;
            }
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            break;
        }

        console.log('');
    }

    // End call
    console.log('─'.repeat(55));
    console.log('📊 Generating call summary...\n');

    const { summary, qualityScore } = await agent.endCall();

    console.log('📝 CALL SUMMARY');
    console.log('─'.repeat(30));
    console.log(`  Qualification: ${summary.qualification}`);
    console.log(`  Budget:        ${summary.budget}`);
    console.log(`  Requirement:   ${summary.requirement}`);
    console.log(`  Sentiment:     ${summary.sentiment}`);
    console.log(`  Next Action:   ${summary.nextAction}`);
    console.log(`  Summary:       ${summary.summary}`);
    console.log('');
    console.log(`⭐ Quality Score: ${qualityScore.score}/10`);
    console.log(`  Details:`, JSON.stringify(qualityScore.details, null, 2));
    console.log('');
    console.log('✅ Simulation complete! Check logs and database for full details.');
    console.log(`  Lead ID: ${leadId}`);
}

// Run
runSimulation().catch(err => {
    console.error('❌ Simulation failed:', err);
    process.exit(1);
});

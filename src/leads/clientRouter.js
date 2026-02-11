/**
 * Client Router — Express API routes for client profile management
 */

const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const { validateClientProfile } = require('../utils/validator');
const { asyncHandler } = require('../utils/errorHandler');
const { listClients } = require('../agents/personaManager');
const config = require('../../config/config.json');

const CLIENTS_DIR = path.resolve(__dirname, '../../', config.paths.clients);
const router = Router();

/**
 * POST /client/create — Create a new client profile with all 6 JSON files
 * Body: { client_id, name, industry, voice?, tone?, aggression?, language?, greeting?, objective? }
 */
router.post('/create', asyncHandler(async (req, res) => {
    const validation = validateClientProfile(req.body);
    if (!validation.valid) {
        return res.status(400).json({ success: false, errors: validation.errors });
    }

    const clientDir = path.join(CLIENTS_DIR, req.body.client_id);
    if (fs.existsSync(clientDir)) {
        return res.status(409).json({
            success: false,
            error: `Client "${req.body.client_id}" already exists.`,
        });
    }

    fs.mkdirSync(clientDir, { recursive: true });

    // Profile
    const profile = {
        client_id: req.body.client_id,
        name: req.body.name,
        industry: req.body.industry,
        voice: req.body.voice || config.openai.defaultVoice || 'nova',
        tone: req.body.tone || 'professional',
        aggression: req.body.aggression || 'normal',
        language: req.body.language || 'English',
        greeting: req.body.greeting || `Hello! This is ${req.body.name}. How can I help you today?`,
        objective: req.body.objective || 'Qualify the lead and schedule a follow-up.',
        closing_message: req.body.closing_message || 'Thank you for your time. We will follow up shortly.',
    };

    // Default files
    const files = {
        'profile.json': profile,
        'faqs.json': req.body.faqs || [],
        'script.json': req.body.script || {
            opening: profile.greeting,
            qualification_questions: [],
            objection_handling: [],
            closing: profile.closing_message,
        },
        'fallback.json': req.body.fallback || {
            level1: 'Attempt a general helpful answer.',
            level2: 'Redirect conversation back to core services.',
            level3: "I'll note this and have someone call you back.",
        },
        'crm_fields.json': req.body.crm_fields || {
            name: '', phone: '', email: '', budget: '', requirement: '', notes: '',
        },
        'constraints.json': req.body.constraints || {
            forbidden_topics: [],
            forbidden_actions: [],
            compliance_rules: [],
            tone_restrictions: [],
            max_promises: 'Do not make guarantees.',
        },
    };

    // Write all files
    for (const [filename, data] of Object.entries(files)) {
        fs.writeFileSync(
            path.join(clientDir, filename),
            JSON.stringify(data, null, 2),
            'utf8'
        );
    }

    res.status(201).json({
        success: true,
        data: {
            clientId: req.body.client_id,
            message: `Client "${req.body.name}" created with all profile files.`,
            files: Object.keys(files),
        },
    });
}));

/**
 * GET /client/list — List all registered clients
 */
router.get('/list', asyncHandler(async (req, res) => {
    const clients = listClients();
    res.json({
        success: true,
        data: { clients, count: clients.length },
    });
}));

module.exports = router;

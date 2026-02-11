/**
 * Lead Router — Express API routes for lead management
 */

const { Router } = require('express');
const { processLead } = require('./leadProcessor');
const { validateLead } = require('../utils/validator');
const { asyncHandler } = require('../utils/errorHandler');
const db = require('../utils/db');
const logger = require('../logs/logger');

const router = Router();

/**
 * POST /lead — Accept a new lead and trigger the call agent
 * Body: { clientId, name, phone, email?, budget?, requirement?, notes? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const validation = validateLead(req.body);
    if (!validation.valid) {
        return res.status(400).json({
            success: false,
            errors: validation.errors,
        });
    }

    const result = await processLead(req.body);

    res.status(201).json({
        success: true,
        data: result,
    });
}));

/**
 * GET /logs/:leadId — Fetch conversation logs for a lead
 */
router.get('/logs/:leadId', asyncHandler(async (req, res) => {
    const { leadId } = req.params;

    // Get from SQLite
    const lead = db.getLead(leadId);
    if (!lead) {
        return res.status(404).json({
            success: false,
            error: `Lead "${leadId}" not found.`,
        });
    }

    const callLogs = db.getCallLogs(leadId);
    const outcome = db.getOutcome(leadId);
    const qualityScore = db.getQualityScore(leadId);
    const jsonlLogs = logger.readLogs(leadId);

    res.json({
        success: true,
        data: {
            lead,
            callLogs,
            outcome,
            qualityScore,
            jsonlLogs,
        },
    });
}));

/**
 * GET /lead/:id/path — Get state path history for a lead
 */
router.get('/:id/path', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const lead = db.getLead(id);
    if (!lead) {
        return res.status(404).json({
            success: false,
            error: `Lead "${id}" not found.`,
        });
    }

    const path = db.getCallPath(id);

    res.json({
        success: true,
        data: { leadId: id, path },
    });
}));

module.exports = router;

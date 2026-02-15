/**
 * Lead Router — Express API routes for lead management
 */

const { Router } = require('express');
const { processLead } = require('./leadProcessor');
const { validateLead } = require('../utils/validator');
const { asyncHandler } = require('../utils/errorHandler');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { makeOutboundCall } = require('../integrations/exotel');
const metrics = require('../utils/metrics');
const config = require('../config');

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

    // Track lead metric
    metrics.incrementLead('processing');

    // Trigger Exotel outbound call
    req.logger.info('Triggering Exotel outbound call', {
        leadId: result.leadId,
        phone: req.body.phone,
        clientId: req.body.clientId
    });

    // Make outbound call (non-blocking)
    makeOutboundCall({
        toNumber: req.body.phone,
        leadId: result.leadId
    }).then(callResult => {
        if (callResult.success) {
            req.logger.info('Exotel call initiated successfully', {
                leadId: result.leadId,
                callSid: callResult.callSid
            });
            metrics.incrementCall('active');
        } else {
            req.logger.error('Exotel call failed', {
                leadId: result.leadId,
                error: callResult.error
            });
            metrics.incrementCall('failed');
        }
    }).catch(error => {
        req.logger.error('Exotel call exception', {
            leadId: result.leadId,
            error: error.message
        });
        metrics.incrementCall('failed');
    });

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

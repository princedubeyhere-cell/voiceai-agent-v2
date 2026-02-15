/**
 * Webhook Router — Handles external service webhooks
 */

const { Router } = require('express');
const { asyncHandler } = require('../utils/errorHandler');
const { handleStatusWebhook } = require('../integrations/exotel');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

const router = Router();

/**
 * POST /webhooks/exotel/status — Exotel call status webhook
 * Receives call status updates from Exotel
 */
router.post('/exotel/status', asyncHandler(async (req, res) => {
    req.logger.info('Exotel status webhook received', {
        callSid: req.body.CallSid,
        status: req.body.Status
    });

    // Process webhook data
    const webhookData = handleStatusWebhook(req.body);

    // Update metrics based on call status
    if (webhookData.dialCallStatus === 'completed') {
        metrics.incrementCall('completed', webhookData.conversationDuration);
        req.logger.info('Call completed successfully', {
            callSid: webhookData.callSid,
            duration: webhookData.conversationDuration
        });
    } else if (webhookData.dialCallStatus === 'failed' || webhookData.dialCallStatus === 'no-answer') {
        metrics.incrementCall('failed');
        req.logger.warn('Call failed or not answered', {
            callSid: webhookData.callSid,
            status: webhookData.dialCallStatus
        });
    }

    // Log call status to database (for future reference)
    // In Phase 2, we'll store this in a call_status table
    req.logger.info('Call status logged', {
        callSid: webhookData.callSid,
        status: webhookData.status,
        dialCallStatus: webhookData.dialCallStatus,
        duration: webhookData.duration,
        conversationDuration: webhookData.conversationDuration
    });

    // Respond to Exotel
    res.status(200).json({
        success: true,
        message: 'Webhook received'
    });
}));

module.exports = router;

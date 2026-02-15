/**
 * Exotel Outbound Calling Integration
 * Phase 1: Basic outbound dialing without AI voice streaming
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Make outbound call via Exotel
 * @param {Object} params - Call parameters
 * @param {string} params.toNumber - Recipient phone number (E.164 format)
 * @param {string} params.fromNumber - Caller ID (optional, uses config default)
 * @param {string} params.leadId - Lead ID for tracking
 * @returns {Promise<Object>} - Exotel call response
 */
async function makeOutboundCall({ toNumber, fromNumber, leadId }) {
    const callLogger = logger.child({ leadId, toNumber });

    try {
        callLogger.info('Initiating Exotel outbound call');

        // Validate configuration
        if (!config.exotel.accountSid || !config.exotel.apiKey || !config.exotel.apiToken) {
            throw new Error('Exotel credentials not configured');
        }

        // Use provided fromNumber or default from config
        const callerNumber = fromNumber || config.exotel.fromNumber;

        if (!callerNumber) {
            throw new Error('From number not provided and no default configured');
        }

        // Exotel API endpoint
        const apiUrl = `https://api.exotel.com/v1/Accounts/${config.exotel.accountSid}/Calls/connect.json`;

        // Prepare request payload
        const payload = {
            From: callerNumber,
            To: toNumber,
            CallerId: callerNumber,
            // StatusCallback will be set to our webhook endpoint
            StatusCallback: `${config.server.publicUrl}/webhooks/exotel/status`,
            // For Phase 1, we're just dialing without AI voice
            // In Phase 2, we'll add URL for voice streaming
        };

        callLogger.info('Sending Exotel API request', {
            from: callerNumber,
            to: toNumber,
            apiUrl
        });

        // Make API request with Basic Auth
        const response = await axios.post(apiUrl, payload, {
            auth: {
                username: config.exotel.apiKey,
                password: config.exotel.apiToken
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000 // 10 second timeout
        });

        const callData = response.data;
        const callSid = callData.Call?.Sid || callData.Sid;

        callLogger.info('Exotel call initiated successfully', {
            callSid,
            status: callData.Call?.Status || callData.Status,
            direction: callData.Call?.Direction || callData.Direction
        });

        return {
            success: true,
            callSid,
            leadId,
            status: callData.Call?.Status || callData.Status,
            data: callData
        };

    } catch (error) {
        callLogger.error('Exotel call failed', {
            error: error.message,
            response: error.response?.data,
            statusCode: error.response?.status
        });

        return {
            success: false,
            error: error.message,
            leadId,
            statusCode: error.response?.status,
            details: error.response?.data
        };
    }
}

/**
 * Handle Exotel webhook status callback
 * @param {Object} webhookData - Exotel webhook payload
 * @returns {Object} - Processed webhook data
 */
function handleStatusWebhook(webhookData) {
    logger.info('Exotel status webhook received', {
        callSid: webhookData.CallSid,
        status: webhookData.Status,
        duration: webhookData.Duration,
        dialCallStatus: webhookData.DialCallStatus
    });

    return {
        callSid: webhookData.CallSid,
        status: webhookData.Status,
        dialCallStatus: webhookData.DialCallStatus,
        duration: parseInt(webhookData.Duration) || 0,
        startTime: webhookData.StartTime,
        endTime: webhookData.EndTime,
        from: webhookData.From,
        to: webhookData.To,
        recordingUrl: webhookData.RecordingUrl,
        conversationDuration: parseInt(webhookData.ConversationDuration) || 0
    };
}

module.exports = {
    makeOutboundCall,
    handleStatusWebhook
};

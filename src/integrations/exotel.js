/**
 * Exotel Outbound Calling Integration (Singapore Region)
 * Phase 1: Basic outbound dialing without AI voice streaming
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

// Exotel Singapore Account SID
const EXOTEL_ACCOUNT_SID = 'datawitydigitaltechnologies1';
const EXOTEL_BASE_URL = `https://api.exotel.com/v1/Accounts/${EXOTEL_ACCOUNT_SID}/Calls/connect.json`;

/**
 * Make outbound call via Exotel (Singapore)
 * @param {Object} params - Call parameters
 * @param {string} params.toNumber - Recipient phone number (E.164 format)
 * @param {string} params.leadId - Lead ID for tracking
 * @returns {Promise<Object>} - Exotel call response with Call SID
 */
async function makeOutboundCall({ toNumber, leadId }) {
    const callLogger = logger.child({ leadId, toNumber });

    try {
        callLogger.info('Initiating Exotel outbound call (Singapore)', {
            accountSid: EXOTEL_ACCOUNT_SID,
            toNumber
        });

        // Validate configuration
        if (!process.env.EXOTEL_API_KEY || !process.env.EXOTEL_API_TOKEN) {
            throw new Error('Exotel API credentials not configured');
        }

        if (!process.env.EXOTEL_FROM_NUMBER) {
            throw new Error('EXOTEL_FROM_NUMBER not configured');
        }

        const fromNumber = process.env.EXOTEL_FROM_NUMBER;

        // Prepare request payload
        const payload = new URLSearchParams({
            From: fromNumber,
            To: toNumber,
            CallerId: fromNumber,
            StatusCallback: `${config.server.publicUrl}/webhooks/exotel/status`
        });

        callLogger.info('Sending Exotel API request', {
            from: fromNumber,
            to: toNumber,
            apiUrl: EXOTEL_BASE_URL
        });

        // Make API request with Basic Auth
        const response = await axios.post(EXOTEL_BASE_URL, payload.toString(), {
            auth: {
                username: process.env.EXOTEL_API_KEY,
                password: process.env.EXOTEL_API_TOKEN
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000 // 10 second timeout
        });

        const callData = response.data;
        const callSid = callData.Call?.Sid || callData.Sid;

        callLogger.info('Exotel call initiated successfully', {
            leadId,
            callSid,
            status: callData.Call?.Status || callData.Status,
            direction: callData.Call?.Direction || callData.Direction,
            fullResponse: callData
        });

        return {
            success: true,
            callSid,
            leadId,
            status: callData.Call?.Status || callData.Status,
            data: callData
        };

    } catch (error) {
        callLogger.error('Exotel call failed - detailed error', {
            leadId,
            error: error.message,
            responseStatus: error.response?.status,
            responseData: error.response?.data,
            responseHeaders: error.response?.headers,
            requestConfig: {
                url: EXOTEL_BASE_URL,
                method: 'POST'
            }
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
        callStatus: webhookData.Status,
        dialCallStatus: webhookData.DialCallStatus,
        callDuration: webhookData.Duration,
        conversationDuration: webhookData.ConversationDuration,
        recordingUrl: webhookData.RecordingUrl,
        fullWebhookData: webhookData
    });

    return {
        callSid: webhookData.CallSid,
        status: webhookData.Status,
        dialCallStatus: webhookData.DialCallStatus,
        duration: parseInt(webhookData.Duration) || 0,
        conversationDuration: parseInt(webhookData.ConversationDuration) || 0,
        startTime: webhookData.StartTime,
        endTime: webhookData.EndTime,
        from: webhookData.From,
        to: webhookData.To,
        recordingUrl: webhookData.RecordingUrl
    };
}

module.exports = {
    makeOutboundCall,
    handleStatusWebhook
};

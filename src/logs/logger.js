/**
 * JSONL Logger — Safe Writer
 * Escapes content properly, writes one JSON object per line.
 * Handles newlines, quotes, unicode, and long text safely.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

const LOGS_DIR = path.resolve(__dirname, '../../', config.paths.logs);

// Ensure logs directory exists
fs.mkdirSync(LOGS_DIR, { recursive: true });

/**
 * Append a log entry to a lead-specific JSONL file.
 * @param {string} leadId
 * @param {Object} entry - { role, message, state, ... }
 */
function appendLog(leadId, entry) {
    try {
        const filePath = path.join(LOGS_DIR, `${leadId}.jsonl`);
        const record = {
            timestamp: new Date().toISOString(),
            leadId,
            ...entry,
        };
        // JSON.stringify handles all escaping: newlines, quotes, unicode
        const line = JSON.stringify(record) + '\n';
        fs.appendFileSync(filePath, line, 'utf8');
    } catch (error) {
        console.error(`[Logger] Failed to write JSONL for lead ${leadId}:`, error.message);
    }
}

/**
 * Read all log entries for a lead.
 * @param {string} leadId
 * @returns {Object[]}
 */
function readLogs(leadId) {
    try {
        const filePath = path.join(LOGS_DIR, `${leadId}.jsonl`);
        if (!fs.existsSync(filePath)) return [];

        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (!content) return [];

        return content.split('\n').map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return { raw: line, parseError: true };
            }
        });
    } catch (error) {
        console.error(`[Logger] Failed to read JSONL for lead ${leadId}:`, error.message);
        return [];
    }
}

/**
 * Log a system event (errors, state changes, etc.)
 * @param {string} leadId
 * @param {string} event
 * @param {Object} data
 */
function logEvent(leadId, event, data = {}) {
    appendLog(leadId, { type: 'event', event, ...data });
}

/**
 * Log a conversation message.
 * @param {string} leadId
 * @param {string} role - 'agent' | 'user' | 'system'
 * @param {string} message
 * @param {string} state - current call state
 */
function logMessage(leadId, role, message, state = '') {
    appendLog(leadId, { type: 'message', role, message, state });
}

/**
 * Log call summary.
 * @param {string} leadId
 * @param {Object} summary
 */
function logSummary(leadId, summary) {
    appendLog(leadId, { type: 'summary', ...summary });
}

module.exports = { appendLog, readLogs, logEvent, logMessage, logSummary };

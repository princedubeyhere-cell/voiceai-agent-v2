/**
 * Client Constraints Loader
 * Loads industry-specific constraints (forbidden answers, compliance rules, etc.)
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config/config.json');

const CLIENTS_DIR = path.resolve(__dirname, '../../', config.paths.clients);

/**
 * Load constraints for a client.
 * @param {string} clientId
 * @returns {Object} - Constraints object or empty defaults
 */
function loadConstraints(clientId) {
    const filePath = path.join(CLIENTS_DIR, clientId, 'constraints.json');

    const defaults = {
        forbidden_topics: [],
        forbidden_actions: [],
        compliance_rules: [],
        tone_restrictions: [],
        max_promises: 'Do not make guarantees or promises on behalf of the company.',
    };

    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`[Constraints] No constraints.json for client ${clientId}, using defaults.`);
            return defaults;
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { ...defaults, ...data };
    } catch (error) {
        console.error(`[Constraints] Error loading constraints for ${clientId}:`, error.message);
        return defaults;
    }
}

module.exports = { loadConstraints };

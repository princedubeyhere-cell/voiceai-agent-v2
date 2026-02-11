/**
 * Persona Manager
 * Loads all 6 client files (profile, faqs, script, fallback, crm_fields, constraints)
 * and provides a unified client configuration object.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config/config.json');

const CLIENTS_DIR = path.resolve(__dirname, '../../', config.paths.clients);

/**
 * Load a single JSON file with fallback to defaults.
 * @param {string} filePath
 * @param {*} defaultValue
 * @returns {*}
 */
function loadJSON(filePath, defaultValue = {}) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`[PersonaManager] Failed to load ${filePath}:`, error.message);
        return defaultValue;
    }
}

/**
 * Load full client configuration.
 * @param {string} clientId
 * @returns {Object|null} - Client configuration or null if not found
 */
function loadClientProfile(clientId) {
    const clientDir = path.join(CLIENTS_DIR, clientId);

    if (!fs.existsSync(clientDir)) {
        console.error(`[PersonaManager] Client directory not found: ${clientDir}`);
        return null;
    }

    const profile = loadJSON(path.join(clientDir, 'profile.json'));
    const faqs = loadJSON(path.join(clientDir, 'faqs.json'), []);
    const script = loadJSON(path.join(clientDir, 'script.json'));
    const fallback = loadJSON(path.join(clientDir, 'fallback.json'));
    const crmFields = loadJSON(path.join(clientDir, 'crm_fields.json'));
    const constraints = loadJSON(path.join(clientDir, 'constraints.json'), {
        forbidden_topics: [],
        forbidden_actions: [],
        compliance_rules: [],
        tone_restrictions: [],
        max_promises: 'Do not make guarantees or promises.',
    });

    return {
        clientId,
        profile,
        faqs,
        script,
        fallback,
        crmFields,
        constraints,
        voice: profile.voice || config.openai.defaultVoice || 'nova',
        tone: profile.tone || config.call.defaultTone || 'professional',
        aggression: profile.aggression || config.call.defaultAggression || 'normal',
        language: profile.language || config.call.defaultLanguage || 'English',
    };
}

/**
 * List all available client IDs.
 * @returns {string[]}
 */
function listClients() {
    try {
        if (!fs.existsSync(CLIENTS_DIR)) return [];
        return fs.readdirSync(CLIENTS_DIR).filter(name => {
            return fs.statSync(path.join(CLIENTS_DIR, name)).isDirectory();
        });
    } catch {
        return [];
    }
}

/**
 * Check if a client exists.
 * @param {string} clientId
 * @returns {boolean}
 */
function clientExists(clientId) {
    return fs.existsSync(path.join(CLIENTS_DIR, clientId, 'profile.json'));
}

module.exports = { loadClientProfile, listClients, clientExists };

/**
 * Input Validator
 * Validates lead payloads and client profile payloads.
 */

/**
 * Validate a new lead payload.
 * @param {Object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLead(body) {
    const errors = [];

    if (!body.clientId || typeof body.clientId !== 'string') {
        errors.push('clientId is required and must be a string.');
    }
    if (!body.name || typeof body.name !== 'string') {
        errors.push('name is required and must be a string.');
    }
    if (!body.phone || typeof body.phone !== 'string') {
        errors.push('phone is required and must be a string.');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a new client profile payload.
 * @param {Object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateClientProfile(body) {
    const errors = [];

    if (!body.client_id || typeof body.client_id !== 'string') {
        errors.push('client_id is required and must be a string.');
    }
    if (!body.name || typeof body.name !== 'string') {
        errors.push('name is required and must be a string.');
    }
    if (!body.industry || typeof body.industry !== 'string') {
        errors.push('industry is required and must be a string.');
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validateLead, validateClientProfile };

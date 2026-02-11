/**
 * Rate Limiter with Exponential Backoff + Jitter
 * Wraps OpenAI API calls to handle rate limits gracefully.
 */

const config = require('../../config/config.json');

const MAX_RETRIES = config.openai.maxRetries || 3;
const BASE_DELAY = config.openai.retryBaseDelay || 1000;

/**
 * Execute a function with retry logic and exponential backoff.
 * @param {Function} fn - Async function to execute
 * @param {string} operationName - For logging
 * @param {number} maxRetries - Max retry attempts
 * @returns {Promise<*>} - Result of fn
 */
async function withRetry(fn, operationName = 'api-call', maxRetries = MAX_RETRIES) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            const isRateLimit = error?.status === 429 || error?.code === 'rate_limit_exceeded';
            const isServerError = error?.status >= 500;
            const isRetryable = isRateLimit || isServerError;

            if (!isRetryable || attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff with jitter
            const delay = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 500;
            console.warn(
                `[RateLimiter] ${operationName} attempt ${attempt + 1} failed (${error.message}). ` +
                `Retrying in ${Math.round(delay)}ms...`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

module.exports = { withRetry };

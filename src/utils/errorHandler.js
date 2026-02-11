/**
 * Global Error Handler
 * Provides graceful degradation for all system components.
 */

/**
 * Wrap an async handler with error catching and fallback response.
 * @param {Function} fn - Async function (req, res, next)
 * @returns {Function} - Express middleware
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Safe execute: run a function, return fallback value on error.
 * Used for non-critical operations like logging.
 * @param {Function} fn - Async function
 * @param {*} fallbackValue - Value to return on error
 * @param {string} context - For logging
 * @returns {Promise<*>}
 */
async function safeExecute(fn, fallbackValue = null, context = 'unknown') {
    try {
        return await fn();
    } catch (error) {
        console.error(`[ErrorHandler] Safe failure in "${context}":`, error.message);
        return fallbackValue;
    }
}

/**
 * Express global error middleware. Mount as last middleware.
 */
function globalErrorMiddleware(err, req, res, _next) {
    console.error(`[ErrorHandler] Unhandled error:`, err.message);
    console.error(err.stack);

    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        success: false,
        error: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
    });
}

module.exports = { asyncHandler, safeExecute, globalErrorMiddleware };

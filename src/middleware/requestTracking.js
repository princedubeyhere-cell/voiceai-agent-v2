/**
 * Request Tracking Middleware
 * Generates UUID for each request and tracks performance
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

/**
 * Request ID Middleware
 * Attaches unique ID to each request for tracking
 */
function requestIdMiddleware(req, res, next) {
    req.requestId = uuidv4();
    req.logger = logger.withRequest(req.requestId);
    next();
}

/**
 * Performance Timing Middleware
 * Measures request duration and logs performance
 */
function performanceMiddleware(req, res, next) {
    const startTime = Date.now();

    // Capture original end function
    const originalEnd = res.end;

    // Override end function to log performance
    res.end = function (...args) {
        const duration = Date.now() - startTime;
        const endpoint = req.route ? req.route.path : req.path;
        const method = req.method;
        const statusCode = res.statusCode;

        // Track metrics
        metrics.trackRequest(method, endpoint, duration);

        // Log request
        req.logger.info('Request completed', {
            method,
            endpoint,
            statusCode,
            duration,
            userAgent: req.get('user-agent')
        });

        // Call original end
        originalEnd.apply(res, args);
    };

    next();
}

module.exports = {
    requestIdMiddleware,
    performanceMiddleware
};

/**
 * Production Logger - Winston Structured Logging
 * Provides JSON structured logs with request tracking
 */

const winston = require('winston');

const serviceName = 'voiceai-agent-v2';
const environment = process.env.NODE_ENV || 'development';

// Custom format for structured logging
const structuredFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: structuredFormat,
    defaultMeta: {
        service: serviceName,
        environment: environment
    },
    transports: [
        // Console transport for Railway logs
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, service, requestId, duration, ...meta }) => {
                    let log = `${timestamp} [${level}] [${service}]`;
                    if (requestId) log += ` [${requestId}]`;
                    log += ` ${message}`;
                    if (duration) log += ` (${duration}ms)`;
                    if (Object.keys(meta).length > 0) {
                        log += ` ${JSON.stringify(meta)}`;
                    }
                    return log;
                })
            )
        })
    ]
});

/**
 * Create child logger with request context
 * @param {string} requestId - Request ID for tracking
 * @returns {winston.Logger} - Child logger with request context
 */
logger.withRequest = function (requestId) {
    return logger.child({ requestId });
};

/**
 * Log with additional metadata
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
logger.logWithMeta = function (level, message, meta = {}) {
    logger.log(level, message, meta);
};

module.exports = logger;

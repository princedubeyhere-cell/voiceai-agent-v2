/**
 * VoiceAI-Agent — Express Server
 * Main entry point. Mounts all routes with global error handling.
 */

// Initialize logger first (before any logging)
const logger = require('./utils/logger');

// ── Global Error Handlers (MUST be first) ─────────────────────────────────
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION - CRITICAL ERROR', {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
    });
    // Don't exit - let Railway restart if needed
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('UNHANDLED PROMISE REJECTION - WARNING', {
        reason: reason,
        promise: promise,
        timestamp: new Date().toISOString()
    });
});

logger.info('Global error handlers registered');

const express = require('express');
const cors = require('cors');
const config = require('./config');
const leadRouter = require('./leads/leadRouter');
const clientRouter = require('./leads/clientRouter');
const webhookRouter = require('./webhooks/webhookRouter');
const { globalErrorMiddleware } = require('./utils/errorHandler');
const metrics = require('./utils/metrics');
const { requestIdMiddleware, performanceMiddleware } = require('./middleware/requestTracking');

logger.info('About to require db module...');
const db = require('./utils/db');
logger.info('DB module required successfully');

const app = express();
const PORT = process.env.PORT || config.server.port || 3000;

// ── Environment Logging ────────────────────────────────────────────────────
logger.info('Server configuration', {
    environment: process.env.NODE_ENV || 'development',
    portSource: process.env.PORT ? 'env.PORT' : (config.server.port ? 'config' : 'fallback'),
    port: PORT,
    host: config.server.host,
    safeMode: config.production.safeMode,
    nodeVersion: process.version
});

// ── Middleware ──────────────────────────────────────────────────────────

// Request tracking and performance monitoring
app.use(requestIdMiddleware);
app.use(performanceMiddleware);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request timeout protection
app.use((req, res, next) => {
    res.setTimeout(config.server.requestTimeout || 30000, () => {
        req.logger.warn('Request timeout', { endpoint: req.path });
        res.status(408).json({
            success: false,
            error: 'Request timed out.',
            code: 'REQUEST_TIMEOUT',
        });
    });
    next();
});

// ── Routes ─────────────────────────────────────────────────────────────

logger.info('Mounting routers...');
app.use('/lead', leadRouter);
app.use('/client', clientRouter);
app.use('/webhooks', webhookRouter);
logger.info('Routers mounted successfully');

// Enhanced health check with deep checks
app.get('/health', async (req, res) => {
    req.logger.info('Health check endpoint hit');

    const healthStatus = {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        nodeVersion: process.version,
        safeMode: config.production.safeMode,
        checks: {
            database: { status: 'unknown' },
            memory: { status: 'unknown' }
        }
    };

    // Database connectivity check
    try {
        const dbHealthy = await db.healthCheck();
        healthStatus.checks.database = {
            status: dbHealthy ? 'healthy' : 'unhealthy',
            connected: dbHealthy
        };
    } catch (error) {
        healthStatus.checks.database = {
            status: 'unhealthy',
            error: error.message
        };
        healthStatus.success = false;
        healthStatus.status = 'degraded';
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    healthStatus.checks.memory = {
        status: 'healthy',
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    };

    res.status(healthStatus.success ? 200 : 503).json(healthStatus);
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    req.logger.info('Metrics endpoint hit');

    if (!config.production.enableMetrics) {
        return res.status(403).json({
            success: false,
            error: 'Metrics endpoint disabled'
        });
    }

    const metricsData = metrics.getMetrics();
    res.json({
        success: true,
        data: metricsData,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.url} not found.`,
    });
});

// Global error handler (must be last)
app.use(globalErrorMiddleware);

// ── Start Server ───────────────────────────────────────────────────────

// Initialize database before starting server (async for PostgreSQL)
logger.info('Initializing database...');
db.initializeDatabase()
    .then(() => {
        logger.info('Database initialized successfully');
        startServer();
    })
    .catch((error) => {
        logger.error('Database initialization failed', { error: error.message });
        logger.warn('Server will start but database operations will fail');
        startServer();
    });

function startServer() {
    logger.info('Starting server...');
    const server = app.listen(PORT, "0.0.0.0", () => {
        logger.info('SERVER STARTED SUCCESSFULLY', {
            port: PORT,
            host: '0.0.0.0',
            environment: process.env.NODE_ENV || 'development',
            healthCheck: `http://0.0.0.0:${PORT}/health`,
            metrics: `http://0.0.0.0:${PORT}/metrics`,
            safeMode: config.production.safeMode
        });
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
        logger.info(`${signal} received, starting graceful shutdown...`);

        server.close(() => {
            logger.info('HTTP server closed');

            // Close database connection
            db.closeConnection()
                .then(() => {
                    logger.info('Database connection closed');
                    logger.info('Graceful shutdown complete');
                    process.exit(0);
                })
                .catch((error) => {
                    logger.error('Error closing database connection', { error: error.message });
                    process.exit(1);
                });
        });

        // Force shutdown after 30 seconds
        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;

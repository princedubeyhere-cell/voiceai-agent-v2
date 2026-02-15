/**
 * VoiceAI-Agent — Express Server
 * Main entry point. Mounts all routes with global error handling.
 */

// ── Global Error Handlers (MUST be first) ─────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('═══════════════════════════════════════════════════════');
    console.error('UNCAUGHT EXCEPTION - CRITICAL ERROR');
    console.error('Time:', new Date().toISOString());
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    console.error('═══════════════════════════════════════════════════════');
    // Don't exit - let Railway restart if needed
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('═══════════════════════════════════════════════════════');
    console.error('UNHANDLED PROMISE REJECTION - WARNING');
    console.error('Time:', new Date().toISOString());
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    console.error('═══════════════════════════════════════════════════════');
});

console.log('[Startup] Global error handlers registered');

const express = require('express');
const cors = require('cors');
const config = require('./config');
const leadRouter = require('./leads/leadRouter');
const clientRouter = require('./leads/clientRouter');
const { globalErrorMiddleware } = require('./utils/errorHandler');

const app = express();
const PORT = process.env.PORT || config.server.port || 3000;

// ── Environment Logging ────────────────────────────────────────────────────
console.log('[Startup] Environment:', process.env.NODE_ENV || 'development');
console.log('[Startup] PORT source:', process.env.PORT ? 'env.PORT' : (config.server.port ? 'config' : 'fallback'));
console.log('[Startup] PORT value:', PORT);
console.log('[Startup] Host:', config.server.host);

// ── Middleware ──────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request timeout protection
app.use((req, res, next) => {
    res.setTimeout(config.server.requestTimeout || 30000, () => {
        res.status(408).json({
            success: false,
            error: 'Request timed out.',
            code: 'REQUEST_TIMEOUT',
        });
    });
    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ── Routes ─────────────────────────────────────────────────────────────

console.log('[Startup] Mounting routers...');
app.use('/lead', leadRouter);
app.use('/client', clientRouter);
console.log('[Startup] Routers mounted successfully');

// Health check
app.get('/health', (req, res) => {
    console.log('[Health] Health check endpoint hit');
    res.json({
        success: true,
        status: 'running',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        port: PORT,
        env: process.env.NODE_ENV || 'development',
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

// Initialize database before starting server
console.log('[Startup] Initializing database...');
try {
    db.initializeDatabase();
    console.log('[Startup] Database initialized successfully');
} catch (error) {
    console.error('[Startup] Database initialization failed:', error.message);
    console.error('[Startup] Server will start but database operations will fail');
}

console.log('[Startup] Starting server...');
app.listen(PORT, "0.0.0.0", () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('✓ SERVER STARTED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Server running on port ${PORT}`);
    console.log(`Server live at http://0.0.0.0:${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('═══════════════════════════════════════════════════════');
});

module.exports = app;

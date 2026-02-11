/**
 * VoiceAI-Agent — Express Server
 * Main entry point. Mounts all routes with global error handling.
 */

const express = require('express');
const cors = require('cors');
const config = require('../config/config.json');
const leadRouter = require('./leads/leadRouter');
const clientRouter = require('./leads/clientRouter');
const { globalErrorMiddleware } = require('./utils/errorHandler');

const app = express();
const PORT = config.server.port || 3000;

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

app.use('/lead', leadRouter);
app.use('/client', clientRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
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

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║         🎙️  VoiceAI Agent System — RUNNING          ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Server:    http://localhost:${PORT}                    ║`);
    console.log('║  Endpoints:                                          ║');
    console.log('║    POST /lead          → Accept new lead             ║');
    console.log('║    POST /client/create → Create client profile       ║');
    console.log('║    GET  /client/list   → List all clients            ║');
    console.log('║    GET  /lead/logs/:id → Fetch call logs             ║');
    console.log('║    GET  /lead/:id/path → State path history          ║');
    console.log('║    GET  /health        → Health check                ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;

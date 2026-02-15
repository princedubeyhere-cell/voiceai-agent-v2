/**
 * PostgreSQL Database Module
 * Migrated from better-sqlite3 due to Railway native module compatibility issues.
 * Uses Railway-provided DATABASE_URL for connection.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let pool = null;
let isInitialized = false;
let initializationError = null;

/**
 * Initialize PostgreSQL connection pool and schema.
 * @returns {boolean} - Whether initialization succeeded
 */
async function initializeDatabase() {
  if (isInitialized) return true;
  if (initializationError) return false;

  try {
    console.log('[Database] Initializing PostgreSQL...');

    // Use Railway-provided DATABASE_URL or fallback
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    console.log('[Database] Connecting to PostgreSQL...');

    // Create connection pool
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const client = await pool.connect();
    console.log('[Database] PostgreSQL connection established');

    // Create schema
    await client.query(`
            CREATE TABLE IF NOT EXISTS leads (
                id TEXT PRIMARY KEY,
                client_id TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT DEFAULT '',
                budget TEXT DEFAULT '',
                requirement TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                status TEXT DEFAULT 'new',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS call_logs (
                id SERIAL PRIMARY KEY,
                lead_id TEXT NOT NULL,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                state TEXT DEFAULT '',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id)
            );

            CREATE TABLE IF NOT EXISTS call_outcomes (
                id SERIAL PRIMARY KEY,
                lead_id TEXT NOT NULL UNIQUE,
                client_id TEXT NOT NULL,
                qualification TEXT DEFAULT '',
                budget TEXT DEFAULT '',
                requirement TEXT DEFAULT '',
                sentiment TEXT DEFAULT '',
                next_action TEXT DEFAULT '',
                summary TEXT DEFAULT '',
                call_duration_seconds REAL DEFAULT 0,
                total_turns INTEGER DEFAULT 0,
                fallbacks_used INTEGER DEFAULT 0,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id)
            );

            CREATE TABLE IF NOT EXISTS call_paths (
                id SERIAL PRIMARY KEY,
                lead_id TEXT NOT NULL,
                state TEXT NOT NULL,
                entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id)
            );

            CREATE TABLE IF NOT EXISTS quality_scores (
                id SERIAL PRIMARY KEY,
                lead_id TEXT NOT NULL UNIQUE,
                score REAL DEFAULT 0,
                fallback_count INTEGER DEFAULT 0,
                interrupt_count INTEGER DEFAULT 0,
                state_errors INTEGER DEFAULT 0,
                call_length_seconds REAL DEFAULT 0,
                completed_flow INTEGER DEFAULT 0,
                details TEXT DEFAULT '{}',
                scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id)
            );
        `);

    client.release();
    console.log('[Database] PostgreSQL schema initialized successfully');
    isInitialized = true;
    return true;

  } catch (error) {
    console.error('[Database] POSTGRESQL INITIALIZATION FAILED');
    console.error('[Database] Error:', error.message);
    console.error('[Database] Stack:', error.stack);
    initializationError = error;
    return false;
  }
}

/**
 * Ensure database is initialized before any operation.
 */
async function ensureInitialized() {
  if (!isInitialized) {
    const success = await initializeDatabase();
    if (!success) {
      throw new Error(`Database initialization failed: ${initializationError?.message || 'Unknown error'}`);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

module.exports = {
  // Expose initialization function
  initializeDatabase,

  // Leads
  async insertLead(lead) {
    await ensureInitialized();
    const result = await pool.query(
      `INSERT INTO leads (id, client_id, name, phone, email, budget, requirement, notes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [lead.id, lead.clientId, lead.name, lead.phone, lead.email || '',
      lead.budget || '', lead.requirement || '', lead.notes || '', lead.status || 'new']
    );
    return result;
  },

  async updateLeadStatus(id, status) {
    await ensureInitialized();
    const result = await pool.query(
      `UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, id]
    );
    return result;
  },

  async getLead(id) {
    await ensureInitialized();
    const result = await pool.query(`SELECT * FROM leads WHERE id = $1`, [id]);
    return result.rows[0];
  },

  // Call Logs
  async insertCallLog(leadId, role, message, state = '') {
    await ensureInitialized();
    const result = await pool.query(
      `INSERT INTO call_logs (lead_id, role, message, state) VALUES ($1, $2, $3, $4)`,
      [leadId, role, message, state]
    );
    return result;
  },

  async getCallLogs(leadId) {
    await ensureInitialized();
    const result = await pool.query(
      `SELECT * FROM call_logs WHERE lead_id = $1 ORDER BY id ASC`,
      [leadId]
    );
    return result.rows;
  },

  // Outcomes
  async upsertOutcome(outcome) {
    await ensureInitialized();
    const result = await pool.query(
      `INSERT INTO call_outcomes (lead_id, client_id, qualification, budget, requirement, 
                                        sentiment, next_action, summary, call_duration_seconds, 
                                        total_turns, fallbacks_used)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (lead_id) DO UPDATE SET
                qualification = $3, budget = $4, requirement = $5,
                sentiment = $6, next_action = $7, summary = $8,
                call_duration_seconds = $9, total_turns = $10,
                fallbacks_used = $11, completed_at = CURRENT_TIMESTAMP`,
      [outcome.leadId, outcome.clientId, outcome.qualification || '', outcome.budget || '',
      outcome.requirement || '', outcome.sentiment || '', outcome.nextAction || '',
      outcome.summary || '', outcome.callDuration || 0, outcome.totalTurns || 0,
      outcome.fallbacksUsed || 0]
    );
    return result;
  },

  async getOutcome(leadId) {
    await ensureInitialized();
    const result = await pool.query(
      `SELECT * FROM call_outcomes WHERE lead_id = $1`,
      [leadId]
    );
    return result.rows[0];
  },

  // Call Paths
  async insertCallPath(leadId, state) {
    await ensureInitialized();
    const result = await pool.query(
      `INSERT INTO call_paths (lead_id, state) VALUES ($1, $2)`,
      [leadId, state]
    );
    return result;
  },

  async getCallPath(leadId) {
    await ensureInitialized();
    const result = await pool.query(
      `SELECT * FROM call_paths WHERE lead_id = $1 ORDER BY id ASC`,
      [leadId]
    );
    return result.rows;
  },

  // Quality Scores
  async upsertQualityScore(data) {
    await ensureInitialized();
    const result = await pool.query(
      `INSERT INTO quality_scores (lead_id, score, fallback_count, interrupt_count, 
                                         state_errors, call_length_seconds, completed_flow, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (lead_id) DO UPDATE SET
                score = $2, fallback_count = $3, interrupt_count = $4,
                state_errors = $5, call_length_seconds = $6,
                completed_flow = $7, details = $8, scored_at = CURRENT_TIMESTAMP`,
      [data.leadId, data.score, data.fallbackCount || 0, data.interruptCount || 0,
      data.stateErrors || 0, data.callLength || 0, data.completedFlow ? 1 : 0,
      JSON.stringify(data.details || {})]
    );
    return result;
  },

  async getQualityScore(leadId) {
    await ensureInitialized();
    const result = await pool.query(
      `SELECT * FROM quality_scores WHERE lead_id = $1`,
      [leadId]
    );
    return result.rows[0];
  },

  // Raw access for special queries
  get raw() {
    if (!isInitialized) {
      throw new Error('Database not initialized');
    }
    return pool;
  },

  // Graceful shutdown
  async close() {
    if (pool) {
      await pool.end();
      console.log('[Database] PostgreSQL connection pool closed');
    }
  },
};

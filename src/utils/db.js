/**
 * SQLite Database Module
 * WAL mode enabled. Tables: leads, call_logs, call_outcomes, call_paths, quality_scores
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const DB_PATH = path.resolve(__dirname, '../../', config.paths.database);

// Ensure directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for concurrent reads/writes
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// ── Schema Initialization ──────────────────────────────────────────────────

db.exec(`
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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    state TEXT DEFAULT '',
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );

  CREATE TABLE IF NOT EXISTS call_outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    completed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );

  CREATE TABLE IF NOT EXISTS call_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    state TEXT NOT NULL,
    entered_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );

  CREATE TABLE IF NOT EXISTS quality_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL UNIQUE,
    score REAL DEFAULT 0,
    fallback_count INTEGER DEFAULT 0,
    interrupt_count INTEGER DEFAULT 0,
    state_errors INTEGER DEFAULT 0,
    call_length_seconds REAL DEFAULT 0,
    completed_flow INTEGER DEFAULT 0,
    details TEXT DEFAULT '{}',
    scored_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );
`);

// ── Prepared Statements ────────────────────────────────────────────────────

const stmts = {
  insertLead: db.prepare(`
    INSERT INTO leads (id, client_id, name, phone, email, budget, requirement, notes, status)
    VALUES (@id, @clientId, @name, @phone, @email, @budget, @requirement, @notes, @status)
  `),

  updateLeadStatus: db.prepare(`
    UPDATE leads SET status = @status, updated_at = datetime('now') WHERE id = @id
  `),

  getLead: db.prepare(`SELECT * FROM leads WHERE id = ?`),

  insertCallLog: db.prepare(`
    INSERT INTO call_logs (lead_id, role, message, state) VALUES (@leadId, @role, @message, @state)
  `),

  getCallLogs: db.prepare(`SELECT * FROM call_logs WHERE lead_id = ? ORDER BY id ASC`),

  upsertOutcome: db.prepare(`
    INSERT INTO call_outcomes (lead_id, client_id, qualification, budget, requirement, sentiment, next_action, summary, call_duration_seconds, total_turns, fallbacks_used)
    VALUES (@leadId, @clientId, @qualification, @budget, @requirement, @sentiment, @nextAction, @summary, @callDuration, @totalTurns, @fallbacksUsed)
    ON CONFLICT(lead_id) DO UPDATE SET
      qualification = @qualification, budget = @budget, requirement = @requirement,
      sentiment = @sentiment, next_action = @nextAction, summary = @summary,
      call_duration_seconds = @callDuration, total_turns = @totalTurns,
      fallbacks_used = @fallbacksUsed, completed_at = datetime('now')
  `),

  getOutcome: db.prepare(`SELECT * FROM call_outcomes WHERE lead_id = ?`),

  insertCallPath: db.prepare(`
    INSERT INTO call_paths (lead_id, state) VALUES (@leadId, @state)
  `),

  getCallPath: db.prepare(`SELECT * FROM call_paths WHERE lead_id = ? ORDER BY id ASC`),

  upsertQualityScore: db.prepare(`
    INSERT INTO quality_scores (lead_id, score, fallback_count, interrupt_count, state_errors, call_length_seconds, completed_flow, details)
    VALUES (@leadId, @score, @fallbackCount, @interruptCount, @stateErrors, @callLength, @completedFlow, @details)
    ON CONFLICT(lead_id) DO UPDATE SET
      score = @score, fallback_count = @fallbackCount, interrupt_count = @interruptCount,
      state_errors = @stateErrors, call_length_seconds = @callLength,
      completed_flow = @completedFlow, details = @details, scored_at = datetime('now')
  `),

  getQualityScore: db.prepare(`SELECT * FROM quality_scores WHERE lead_id = ?`),
};

// ── Public API ─────────────────────────────────────────────────────────────

module.exports = {
  // Leads
  insertLead(lead) {
    return stmts.insertLead.run({
      id: lead.id,
      clientId: lead.clientId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email || '',
      budget: lead.budget || '',
      requirement: lead.requirement || '',
      notes: lead.notes || '',
      status: lead.status || 'new',
    });
  },

  updateLeadStatus(id, status) {
    return stmts.updateLeadStatus.run({ id, status });
  },

  getLead(id) {
    return stmts.getLead.get(id);
  },

  // Call Logs
  insertCallLog(leadId, role, message, state = '') {
    return stmts.insertCallLog.run({ leadId, role, message, state });
  },

  getCallLogs(leadId) {
    return stmts.getCallLogs.all(leadId);
  },

  // Outcomes
  upsertOutcome(outcome) {
    return stmts.upsertOutcome.run({
      leadId: outcome.leadId,
      clientId: outcome.clientId,
      qualification: outcome.qualification || '',
      budget: outcome.budget || '',
      requirement: outcome.requirement || '',
      sentiment: outcome.sentiment || '',
      nextAction: outcome.nextAction || '',
      summary: outcome.summary || '',
      callDuration: outcome.callDuration || 0,
      totalTurns: outcome.totalTurns || 0,
      fallbacksUsed: outcome.fallbacksUsed || 0,
    });
  },

  getOutcome(leadId) {
    return stmts.getOutcome.get(leadId);
  },

  // Call Paths
  insertCallPath(leadId, state) {
    return stmts.insertCallPath.run({ leadId, state });
  },

  getCallPath(leadId) {
    return stmts.getCallPath.all(leadId);
  },

  // Quality Scores
  upsertQualityScore(data) {
    return stmts.upsertQualityScore.run({
      leadId: data.leadId,
      score: data.score,
      fallbackCount: data.fallbackCount || 0,
      interruptCount: data.interruptCount || 0,
      stateErrors: data.stateErrors || 0,
      callLength: data.callLength || 0,
      completedFlow: data.completedFlow ? 1 : 0,
      details: JSON.stringify(data.details || {}),
    });
  },

  getQualityScore(leadId) {
    return stmts.getQualityScore.get(leadId);
  },

  // Raw access for special queries
  raw: db,
};

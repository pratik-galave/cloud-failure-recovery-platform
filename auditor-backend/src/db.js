const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

// Ensure data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'faultlens.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance concurrency
db.exec('PRAGMA journal_mode = WAL;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL UNIQUE,
    health_endpoint TEXT NOT NULL DEFAULT '/health',
    check_interval_seconds INTEGER NOT NULL DEFAULT 10,
    failure_threshold INTEGER NOT NULL DEFAULT 2,
    timeout_ms INTEGER NOT NULL DEFAULT 4000,
    degraded_latency_threshold_ms INTEGER NOT NULL DEFAULT 1500,
    description TEXT,
    created_at TEXT NOT NULL,
    last_successful_check TEXT,
    last_checked_at TEXT,
    current_status TEXT NOT NULL DEFAULT 'INITIALIZING',
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    consecutive_successes INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS probes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER DEFAULT 1,
    timestamp TEXT NOT NULL,
    status_code INTEGER,
    latency_ms REAL, -- NULL if probe timed out or connection refused (prevents confusion with 0ms)
    status_text TEXT,
    is_healthy INTEGER,
    error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER DEFAULT 1,
    incident_type TEXT NOT NULL,
    status TEXT NOT NULL, -- 'OPEN' or 'RESOLVED'
    started_at TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    resolved_at TEXT,
    duration_seconds REAL,
    trigger_cause TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER DEFAULT 1,
    scenario_id TEXT NOT NULL,
    scenario_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    mttd_seconds REAL,
    mttr_seconds REAL,
    sla_threshold_seconds REAL,
    sla_passed INTEGER,
    report_summary TEXT
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER DEFAULT 1,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  );
`);

// Migration helper: dynamically add missing columns to existing tables
function ensureColumn(tableName, columnName, typeDef) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some(c => c.name === columnName);
    if (!exists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${typeDef}`);
      console.log(`[Database Migration] Added ${columnName} to ${tableName}`);
    }
  } catch (err) {
    console.error(`[Database Migration Error] ${tableName}.${columnName}:`, err.message);
  }
}

// Applications migrations
ensureColumn('applications', 'check_interval_seconds', 'INTEGER NOT NULL DEFAULT 10');
ensureColumn('applications', 'failure_threshold', 'INTEGER NOT NULL DEFAULT 2');
ensureColumn('applications', 'timeout_ms', 'INTEGER NOT NULL DEFAULT 4000');
ensureColumn('applications', 'degraded_latency_threshold_ms', 'INTEGER NOT NULL DEFAULT 1500');
ensureColumn('applications', 'last_successful_check', 'TEXT');
ensureColumn('applications', 'last_checked_at', 'TEXT');
ensureColumn('applications', 'current_status', "TEXT NOT NULL DEFAULT 'INITIALIZING'");
ensureColumn('applications', 'consecutive_failures', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('applications', 'consecutive_successes', 'INTEGER NOT NULL DEFAULT 0');

// Foreign key migrations
ensureColumn('probes', 'app_id', 'INTEGER DEFAULT 1');
ensureColumn('incidents', 'app_id', 'INTEGER DEFAULT 1');
ensureColumn('audit_runs', 'app_id', 'INTEGER DEFAULT 1');

// Stage 4 Audit Runs Lifecycle Columns
ensureColumn('audit_runs', 'injected_at', 'TEXT');
ensureColumn('audit_runs', 'detected_at', 'TEXT');
ensureColumn('audit_runs', 'recovery_attempted_at', 'TEXT');
ensureColumn('audit_runs', 'verified_at', 'TEXT');
ensureColumn('audit_runs', 'execution_mode', "TEXT DEFAULT 'SAFE_PROCESS_SIMULATION'");
ensureColumn('audit_runs', 'event_logs', 'TEXT');
ensureColumn('audit_runs', 'final_outcome', 'TEXT');
ensureColumn('audit_runs', 'is_simulated', 'INTEGER DEFAULT 0');

// Seed default Target Microservice if empty
const defaultTargetUrl = process.env.TARGET_SERVICE_URL || 'http://localhost:5001';
const existingApps = db.prepare('SELECT COUNT(*) as count FROM applications').get();

if (!existingApps || existingApps.count === 0) {
  const insertDefaultApp = db.prepare(`
    INSERT INTO applications (
      id, name, base_url, health_endpoint, check_interval_seconds, failure_threshold,
      timeout_ms, degraded_latency_threshold_ms, description, created_at, is_active
    )
    VALUES (1, ?, ?, '/health', 10, 2, 4000, 1500, ?, ?, 1)
  `);
  insertDefaultApp.run(
    'Order & Catalog Microservice',
    defaultTargetUrl,
    'Core e-commerce workload simulating order processing, inventory, and database dependencies.',
    new Date().toISOString()
  );

  db.prepare(`
    INSERT INTO activity_logs (app_id, event_type, severity, message, details, created_at)
    VALUES (1, 'SYSTEM_INIT', 'INFO', 'FaultLens auditor initialized with default target application', ?, ?)
  `).run(`Target URL: ${defaultTargetUrl} (Check interval: 10s)`, new Date().toISOString());

  console.log(`[Database] Seeded default application #1 at ${defaultTargetUrl}`);
}

console.log(`[Database] SQLite ready at ${dbPath}`);

// ==========================================
// 1. Applications CRUD & State Management
// ==========================================

function getApplications() {
  const stmt = db.prepare(`
    SELECT * FROM applications WHERE is_active = 1 ORDER BY id ASC
  `);
  return stmt.all();
}

function getApplicationById(id) {
  const stmt = db.prepare(`
    SELECT * FROM applications WHERE id = ?
  `);
  return stmt.get(id) || null;
}

function createApplication({
  name,
  baseUrl,
  healthEndpoint = '/health',
  checkIntervalSeconds = 10,
  failureThreshold = 2,
  timeoutMs = 4000,
  degradedLatencyThresholdMs = 1500,
  description
}) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const cleanEndpoint = healthEndpoint.startsWith('/') ? healthEndpoint : `/${healthEndpoint}`;
  const interval = Math.max(2, parseInt(checkIntervalSeconds, 10) || 10);
  const threshold = Math.max(1, parseInt(failureThreshold, 10) || 2);
  const timeout = Math.max(1000, parseInt(timeoutMs, 10) || 4000);
  const degradedLatency = Math.max(100, parseInt(degradedLatencyThresholdMs, 10) || 1500);

  const stmt = db.prepare(`
    INSERT INTO applications (
      name, base_url, health_endpoint, check_interval_seconds, failure_threshold,
      timeout_ms, degraded_latency_threshold_ms, description, created_at, is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    name,
    cleanUrl,
    cleanEndpoint,
    interval,
    threshold,
    timeout,
    degradedLatency,
    description || null,
    now
  );
  const newId = result.lastInsertRowid;

  logActivity({
    appId: newId,
    eventType: 'APP_REGISTERED',
    severity: 'INFO',
    message: `Registered application "${name}" (${cleanUrl})`,
    details: `Interval: ${interval}s | Threshold: ${threshold} fails | Probe: ${cleanEndpoint}`
  });

  return getApplicationById(newId);
}

function updateApplicationConfig(id, config) {
  const app = getApplicationById(id);
  if (!app) return null;

  const healthEndpoint = config.healthEndpoint !== undefined ? config.healthEndpoint : app.health_endpoint;
  const checkInterval = config.checkIntervalSeconds !== undefined ? Math.max(2, parseInt(config.checkIntervalSeconds, 10)) : app.check_interval_seconds;
  const failureThreshold = config.failureThreshold !== undefined ? Math.max(1, parseInt(config.failureThreshold, 10)) : app.failure_threshold;
  const timeoutMs = config.timeoutMs !== undefined ? Math.max(1000, parseInt(config.timeoutMs, 10)) : app.timeout_ms;
  const degradedLatency = config.degradedLatencyThresholdMs !== undefined ? Math.max(100, parseInt(config.degradedLatencyThresholdMs, 10)) : app.degraded_latency_threshold_ms;
  const description = config.description !== undefined ? config.description : app.description;

  const stmt = db.prepare(`
    UPDATE applications
    SET health_endpoint = ?,
        check_interval_seconds = ?,
        failure_threshold = ?,
        timeout_ms = ?,
        degraded_latency_threshold_ms = ?,
        description = ?
    WHERE id = ?
  `);

  stmt.run(healthEndpoint, checkInterval, failureThreshold, timeoutMs, degradedLatency, description, id);

  logActivity({
    appId: id,
    eventType: 'CONFIG_UPDATED',
    severity: 'INFO',
    message: `Updated monitoring configuration for "${app.name}"`,
    details: `Interval: ${checkInterval}s | Threshold: ${failureThreshold} fails | Timeout: ${timeoutMs}ms`
  });

  return getApplicationById(id);
}

function updateApplicationState(id, { currentStatus, lastCheckedAt, lastSuccessfulCheck, consecutiveFailures, consecutiveSuccesses }) {
  const stmt = db.prepare(`
    UPDATE applications
    SET current_status = COALESCE(?, current_status),
        last_checked_at = COALESCE(?, last_checked_at),
        last_successful_check = COALESCE(?, last_successful_check),
        consecutive_failures = COALESCE(?, consecutive_failures),
        consecutive_successes = COALESCE(?, consecutive_successes)
    WHERE id = ?
  `);

  stmt.run(
    currentStatus ?? null,
    lastCheckedAt ?? null,
    lastSuccessfulCheck ?? null,
    consecutiveFailures ?? null,
    consecutiveSuccesses ?? null,
    id
  );
}

function deleteApplication(id) {
  const app = getApplicationById(id);
  if (!app) return false;

  const stmt = db.prepare(`
    UPDATE applications SET is_active = 0 WHERE id = ?
  `);
  stmt.run(id);

  logActivity({
    appId: id,
    eventType: 'APP_REMOVED',
    severity: 'WARN',
    message: `Application "${app.name}" was deregistered from monitoring`,
    details: `Previous base URL: ${app.base_url}`
  });

  return true;
}

// ==========================================
// 2. Health Probes
// ==========================================

const insertProbeStmt = db.prepare(`
  INSERT INTO probes (app_id, timestamp, status_code, latency_ms, status_text, is_healthy, error_message)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

function saveProbe(probe) {
  // If probe failed or timed out, latency_ms is kept as null so it is clearly distinguished from 0ms latency
  const latency = probe.isHealthy && probe.latencyMs !== null ? probe.latencyMs : null;

  insertProbeStmt.run(
    probe.appId || 1,
    probe.timestamp || new Date().toISOString(),
    probe.statusCode ?? null,
    latency,
    probe.statusText || 'UNKNOWN',
    probe.isHealthy ? 1 : 0,
    probe.errorMessage || null
  );
}

function getRecentProbes(limit = 40, appId = null) {
  if (appId) {
    const stmt = db.prepare(`
      SELECT * FROM probes WHERE app_id = ? ORDER BY id DESC LIMIT ?
    `);
    return stmt.all(appId, limit).reverse();
  }
  const stmt = db.prepare(`
    SELECT * FROM probes ORDER BY id DESC LIMIT ?
  `);
  return stmt.all(limit).reverse();
}

// ==========================================
// 3. Incidents
// ==========================================

const insertIncidentStmt = db.prepare(`
  INSERT INTO incidents (app_id, incident_type, status, started_at, detected_at, trigger_cause, notes)
  VALUES (?, ?, 'OPEN', ?, ?, ?, ?)
`);

function openIncident({ appId = 1, incidentType, startedAt, detectedAt, triggerCause, notes }) {
  const now = new Date().toISOString();
  const result = insertIncidentStmt.run(
    appId,
    incidentType,
    startedAt || now,
    detectedAt || now,
    triggerCause || 'Health probe failed',
    notes || null
  );
  const incidentId = result.lastInsertRowid;

  logActivity({
    appId,
    eventType: 'INCIDENT_DETECTED',
    severity: 'ERROR',
    message: `Incident #${incidentId} (${incidentType}) opened`,
    details: triggerCause || 'Consecutive failure threshold exceeded'
  });

  return incidentId;
}

const resolveIncidentStmt = db.prepare(`
  UPDATE incidents
  SET status = 'RESOLVED',
      resolved_at = ?,
      duration_seconds = ?,
      notes = COALESCE(?, notes)
  WHERE id = ?
`);

function closeIncident({ id, resolvedAt, durationSeconds, notes, appId = 1 }) {
  const now = new Date().toISOString();
  resolveIncidentStmt.run(
    resolvedAt || now,
    durationSeconds,
    notes || null,
    id
  );

  logActivity({
    appId,
    eventType: 'INCIDENT_RESOLVED',
    severity: 'SUCCESS',
    message: `Incident #${id} resolved after ${durationSeconds}s downtime`,
    details: notes || 'Service verified recovered'
  });
}

function getActiveIncidents(appId = null) {
  if (appId) {
    const stmt = db.prepare(`
      SELECT * FROM incidents WHERE status = 'OPEN' AND app_id = ? ORDER BY id DESC
    `);
    return stmt.all(appId);
  }
  const stmt = db.prepare(`
    SELECT * FROM incidents WHERE status = 'OPEN' ORDER BY id DESC
  `);
  return stmt.all();
}

function getIncidents(limit = 30, appId = null) {
  if (appId) {
    const stmt = db.prepare(`
      SELECT i.*, a.name as app_name
      FROM incidents i
      LEFT JOIN applications a ON i.app_id = a.id
      WHERE i.app_id = ?
      ORDER BY i.id DESC LIMIT ?
    `);
    return stmt.all(appId, limit);
  }
  const stmt = db.prepare(`
    SELECT i.*, a.name as app_name
    FROM incidents i
    LEFT JOIN applications a ON i.app_id = a.id
    ORDER BY i.id DESC LIMIT ?
  `);
  return stmt.all(limit);
}

// ==========================================
// 4. Audit Runs (Experiments)
// ==========================================

const insertAuditRunStmt = db.prepare(`
  INSERT INTO audit_runs (
    app_id, scenario_id, scenario_name, started_at, completed_at,
    mttd_seconds, mttr_seconds, sla_threshold_seconds, sla_passed, report_summary,
    injected_at, detected_at, recovery_attempted_at, verified_at,
    execution_mode, event_logs, final_outcome, is_simulated
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function saveAuditRun(run) {
  const result = insertAuditRunStmt.run(
    run.appId || 1,
    run.scenarioId,
    run.scenarioName,
    run.startedAt || new Date().toISOString(),
    run.completedAt || new Date().toISOString(),
    run.mttdSeconds ?? null,
    run.mttrSeconds ?? null,
    run.slaThresholdSeconds || 15.0,
    run.slaPassed ? 1 : 0,
    typeof run.reportSummary === 'object' ? JSON.stringify(run.reportSummary) : run.reportSummary,
    run.injectedAt || null,
    run.detectedAt || null,
    run.recoveryAttemptedAt || null,
    run.verifiedAt || null,
    run.executionMode || 'SAFE_PROCESS_SIMULATION',
    typeof run.eventLogs === 'object' ? JSON.stringify(run.eventLogs) : run.eventLogs || '[]',
    run.finalOutcome || (run.slaPassed ? 'SUCCESS_SLA_COMPLIANT' : 'SUCCESS_SLA_BREACHED'),
    run.isSimulated ? 1 : 0
  );
  return result.lastInsertRowid;
}

function getAuditRuns(limit = 30, appId = null) {
  if (appId) {
    const stmt = db.prepare(`
      SELECT r.*, a.name as app_name
      FROM audit_runs r
      LEFT JOIN applications a ON r.app_id = a.id
      WHERE r.app_id = ?
      ORDER BY r.id DESC LIMIT ?
    `);
    return stmt.all(appId, limit);
  }
  const stmt = db.prepare(`
    SELECT r.*, a.name as app_name
    FROM audit_runs r
    LEFT JOIN applications a ON r.app_id = a.id
    ORDER BY r.id DESC LIMIT ?
  `);
  return stmt.all(limit);
}

function getAuditRunById(id) {
  const stmt = db.prepare(`
    SELECT r.*, a.name as app_name, a.base_url as app_base_url
    FROM audit_runs r
    LEFT JOIN applications a ON r.app_id = a.id
    WHERE r.id = ?
  `);
  return stmt.get(id) || null;
}

// ==========================================
// 5. Activity Logs
// ==========================================

const insertActivityStmt = db.prepare(`
  INSERT INTO activity_logs (app_id, event_type, severity, message, details, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

function logActivity({ appId = 1, eventType, severity = 'INFO', message, details }) {
  try {
    insertActivityStmt.run(
      appId,
      eventType,
      severity,
      message,
      details || null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('[Activity Log Error]:', err.message);
  }
}

function getActivityLogs(limit = 50, appId = null) {
  if (appId) {
    const stmt = db.prepare(`
      SELECT l.*, a.name as app_name
      FROM activity_logs l
      LEFT JOIN applications a ON l.app_id = a.id
      WHERE l.app_id = ?
      ORDER BY l.id DESC LIMIT ?
    `);
    return stmt.all(appId, limit);
  }
  const stmt = db.prepare(`
    SELECT l.*, a.name as app_name
    FROM activity_logs l
    LEFT JOIN applications a ON l.app_id = a.id
    ORDER BY l.id DESC LIMIT ?
  `);
  return stmt.all(limit);
}

// ==========================================
// 6. High-Level Metrics Summary
// ==========================================

function getMetricsSummary() {
  const totalAppsRow = db.prepare('SELECT COUNT(*) as count FROM applications WHERE is_active = 1').get();
  const totalProbesRow = db.prepare('SELECT COUNT(*) as count FROM probes').get();
  const healthyProbesRow = db.prepare('SELECT COUNT(*) as count FROM probes WHERE is_healthy = 1').get();
  const totalIncidentsRow = db.prepare('SELECT COUNT(*) as count FROM incidents').get();
  const activeIncidentsRow = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'OPEN'").get();
  const resolvedIncidentsRow = db.prepare("SELECT COUNT(*) as count, AVG(duration_seconds) as avg_mttr FROM incidents WHERE status = 'RESOLVED'").get();
  const auditRunsCount = db.prepare('SELECT COUNT(*) as count, SUM(sla_passed) as passed FROM audit_runs').get();

  const totalProbes = totalProbesRow ? totalProbesRow.count : 0;
  const healthyProbes = healthyProbesRow ? healthyProbesRow.count : 0;
  const availabilityPct = totalProbes > 0 ? ((healthyProbes / totalProbes) * 100).toFixed(2) : '100.00';

  return {
    totalApplications: totalAppsRow ? totalAppsRow.count : 0,
    totalProbes,
    healthyProbes,
    availabilityPercentage: Number(availabilityPct),
    totalIncidents: totalIncidentsRow ? totalIncidentsRow.count : 0,
    activeIncidents: activeIncidentsRow ? activeIncidentsRow.count : 0,
    resolvedIncidents: resolvedIncidentsRow ? resolvedIncidentsRow.count : 0,
    averageMttrSeconds: resolvedIncidentsRow && resolvedIncidentsRow.avg_mttr ? Number(resolvedIncidentsRow.avg_mttr.toFixed(1)) : 0,
    totalAuditRuns: auditRunsCount ? auditRunsCount.count : 0,
    slaPassedRuns: auditRunsCount && auditRunsCount.passed ? auditRunsCount.passed : 0
  };
}

module.exports = {
  db,
  getApplications,
  getApplicationById,
  createApplication,
  updateApplicationConfig,
  updateApplicationState,
  deleteApplication,
  saveProbe,
  getRecentProbes,
  openIncident,
  closeIncident,
  getActiveIncidents,
  getIncidents,
  saveAuditRun,
  getAuditRuns,
  getAuditRunById,
  logActivity,
  getActivityLogs,
  getMetricsSummary
};

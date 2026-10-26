const db = require('./db');
const { sanitizeErrorMessage } = require('./security');

const TICK_INTERVAL_MS = 1000; // Single master clock tick
const RECOVERY_THRESHOLD = 2;   // 2 consecutive successes required to confirm stable recovery

let masterSchedulerTimer = null;
const inFlightProbes = new Set(); // Concurrency guard: prevents duplicate polling jobs

// In-memory runtime state per application
const appStates = new Map();

function getOrCreateAppState(app) {
  if (!appStates.has(app.id)) {
    appStates.set(app.id, {
      appId: app.id,
      status: app.current_status || 'INITIALIZING',
      consecutiveFailures: app.consecutive_failures || 0,
      consecutiveSuccesses: app.consecutive_successes || 0,
      failureStartTimestamp: null,
      lastCheckedTimestamp: app.last_checked_at ? new Date(app.last_checked_at).getTime() : 0,
      lastSuccessfulCheck: app.last_successful_check || null,
      lastProbe: null,
      activeIncident: null
    });
  }
  return appStates.get(app.id);
}

// Global listeners for chaos scenario runner
const probeListeners = new Set();

function registerProbeListener(listener) {
  probeListeners.add(listener);
  return () => probeListeners.delete(listener);
}

// Active synthetic prober faults per application (for external / non-containerized microservices)
const activeSimulatedFaults = new Map();

function injectSyntheticFault(appId, faultType = 'OUTAGE') {
  // Fault remains active until Phase 3 recovery explicitly clears it (with a 45s safety ceiling)
  const endsAt = Date.now() + 45000;
  activeSimulatedFaults.set(appId, { faultType, endsAt });
  console.log(`[Synthetic Prober Chaos] Injected ${faultType} on App #${appId}`);
}

function clearSyntheticFault(appId) {
  activeSimulatedFaults.delete(appId);
  console.log(`[Synthetic Prober Chaos] Cleared synthetic fault on App #${appId}`);
}

function getActiveSyntheticFault(appId) {
  const fault = activeSimulatedFaults.get(appId);
  if (!fault) return null;
  if (Date.now() >= fault.endsAt) {
    activeSimulatedFaults.delete(appId);
    return null;
  }
  return fault;
}

/**
 * Executes a single health check probe against a registered application.
 */
async function probeApplication(app) {
  if (inFlightProbes.has(app.id)) {
    // Probe is already in-flight for this application; skip this tick to prevent unbounded requests
    return null;
  }

  inFlightProbes.add(app.id);
  const state = getOrCreateAppState(app);
  const probeTimestamp = new Date().toISOString();
  state.lastCheckedTimestamp = Date.now();

  const timeoutMs = app.timeout_ms || 4000;
  const degradedThreshold = app.degraded_latency_threshold_ms || 1500;
  const failureThreshold = app.failure_threshold || 2;
  const targetUrl = `${app.base_url}${app.health_endpoint || '/health'}`;

  let isHealthy = false;
  let statusCode = null;
  let latencyMs = null; // Stored as null if unreachable (clearly distinguishes unavailable from 0ms)
  let statusText = 'UNAVAILABLE';
  let errorMessage = null;

  const startTime = performance.now();

  try {
    const activeSyntheticFault = getActiveSyntheticFault(app.id);
    if (activeSyntheticFault) {
      if (activeSyntheticFault.faultType === 'STORAGE_QUOTA_SIMULATION' || activeSyntheticFault.faultType === 'LATENCY_SPIKE') {
        // Simulate high latency / degraded state
        await new Promise(r => setTimeout(r, Math.min(2000, timeoutMs - 500)));
        isHealthy = true;
        statusCode = 200;
        latencyMs = Math.round(performance.now() - startTime);
        statusText = 'DEGRADED';
      } else {
        // Simulate complete connection refusal / network outage
        throw new Error(`Synthetic Chaos Injection: Simulated network partition / connection dropped for ${app.name}`);
      }
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'FaultLens-HealthProber/2.0 (+https://github.com/cloud-project/faultlens)',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      clearTimeout(timer);

      const duration = Math.round(performance.now() - startTime);
      statusCode = response.status;

      let body = {};
      try {
        body = await response.json();
      } catch (e) {}

    // Explicit Rule Classification:
    if (response.ok) { // HTTP 2xx
      latencyMs = duration;
      if (duration >= degradedThreshold || body.status === 'DEGRADED') {
        isHealthy = true;
        statusText = 'DEGRADED';
      } else {
        isHealthy = true;
        statusText = 'HEALTHY';
      }
    } else { // HTTP 4xx, 5xx
      isHealthy = false;
      statusText = 'UNAVAILABLE';
      statusCode = response.status;
      latencyMs = duration; // Recorded duration for server response errors
      errorMessage = body.error || `HTTP ${statusCode} Server Error`;
    }
  }
} catch (err) {
    isHealthy = false;
    statusText = 'UNAVAILABLE';
    statusCode = null;
    latencyMs = null; // Explicit null: distinct from 0ms latency

    if (err.name === 'AbortError') {
      errorMessage = `Probe timed out after ${timeoutMs}ms`;
    } else if (err.code === 'ECONNREFUSED' || (err.message && err.message.includes('fetch failed'))) {
      errorMessage = `Connection refused at ${targetUrl}`;
    } else {
      errorMessage = sanitizeErrorMessage(err.message || 'Network destination unreachable');
    }
  } finally {
    inFlightProbes.delete(app.id);
  }

  // Record probe record to SQLite
  const probeRecord = {
    appId: app.id,
    timestamp: probeTimestamp,
    statusCode,
    latencyMs,
    statusText,
    isHealthy,
    errorMessage
  };

  try {
    db.saveProbe(probeRecord);
  } catch (dbErr) {
    console.error(`[Monitor] Error saving probe for App #${app.id}:`, dbErr.message);
  }

  state.lastProbe = probeRecord;

  // State Machine Evaluation
  if (isHealthy) {
    handleProbeSuccess(app, state, probeRecord);
  } else {
    handleProbeFailure(app, state, probeRecord, failureThreshold);
  }

  // Update application state in database for fast dashboard queries
  try {
    db.updateApplicationState(app.id, {
      currentStatus: state.status,
      lastCheckedAt: probeTimestamp,
      lastSuccessfulCheck: state.lastSuccessfulCheck,
      consecutiveFailures: state.consecutiveFailures,
      consecutiveSuccesses: state.consecutiveSuccesses
    });
  } catch (e) {}

  // Notify registered scenario listeners
  for (const listener of probeListeners) {
    try {
      listener(probeRecord, state, app);
    } catch (lErr) {
      console.error('[Monitor] Listener error:', lErr.message);
    }
  }

  return probeRecord;
}

function handleProbeSuccess(app, state, probeRecord) {
  state.consecutiveFailures = 0;
  state.consecutiveSuccesses += 1;
  state.failureStartTimestamp = null;
  state.lastSuccessfulCheck = probeRecord.timestamp;

  if (probeRecord.statusText === 'DEGRADED') {
    state.status = 'DEGRADED';
  } else {
    state.status = 'HEALTHY';
  }

  // Check if open incident can be closed
  if (state.activeIncident && state.consecutiveSuccesses >= RECOVERY_THRESHOLD) {
    const active = state.activeIncident;
    const resolvedAt = new Date().toISOString();
    const durationSeconds = Number(((new Date(resolvedAt) - new Date(active.started_at)) / 1000).toFixed(1));

    console.log(`[Incident Resolved] App #${app.id} (${app.name}) - Incident #${active.id} resolved in ${durationSeconds}s`);

    db.closeIncident({
      id: active.id,
      resolvedAt,
      durationSeconds,
      notes: `Service passed ${state.consecutiveSuccesses} consecutive health checks.`,
      appId: app.id
    });

    state.activeIncident = null;
  }
}

function handleProbeFailure(app, state, probeRecord, failureThreshold) {
  state.consecutiveSuccesses = 0;
  state.consecutiveFailures += 1;

  // Record start time of the failure streak on first failure
  if (state.consecutiveFailures === 1) {
    state.failureStartTimestamp = probeRecord.timestamp;
  }

  state.status = 'UNAVAILABLE';

  // Only declare Incident when consecutive failures exceed threshold (prevents alert flapping)
  if (state.consecutiveFailures >= failureThreshold && !state.activeIncident) {
    const startedAt = state.failureStartTimestamp || probeRecord.timestamp;
    const detectedAt = new Date().toISOString();
    const incidentType = probeRecord.statusCode === 500
      ? 'HTTP_500_OUTAGE'
      : (probeRecord.statusCode === null ? 'ENDPOINT_UNREACHABLE' : `HTTP_${probeRecord.statusCode}_ERROR`);

    console.warn(`[Incident Detected] App #${app.id} (${app.name}) reached ${failureThreshold} consecutive failures! Opening Incident.`);

    const newId = db.openIncident({
      appId: app.id,
      incidentType,
      startedAt,
      detectedAt,
      triggerCause: probeRecord.errorMessage || `Health check failed with status ${probeRecord.statusCode}`,
      notes: `Consecutive failures threshold (${failureThreshold}) exceeded.`
    });

    state.activeIncident = {
      id: newId,
      app_id: app.id,
      incident_type: incidentType,
      status: 'OPEN',
      started_at: startedAt,
      detected_at: detectedAt,
      trigger_cause: probeRecord.errorMessage
    };
  }
}

/**
 * Single master scheduler: executes every 1000ms.
 * Checks each registered application's configured check_interval_seconds.
 * Prevents multiple timers or unbounded background intervals.
 */
async function schedulerTick() {
  try {
    const apps = db.getApplications();
    const now = Date.now();

    for (const app of apps) {
      const state = getOrCreateAppState(app);
      // High frequency probing (1.5s) when under active chaos testing to measure accurate MTTD & MTTR
      const isUnderChaosAudit = activeSimulatedFaults.has(app.id) || (probeListeners.size > 0);
      const intervalMs = isUnderChaosAudit ? 1500 : (app.check_interval_seconds || 10) * 1000;
      const elapsed = now - (state.lastCheckedTimestamp || 0);

      if (elapsed >= intervalMs) {
        // Run probe asynchronously (non-blocking, guarded against overlapping probes)
        probeApplication(app).catch(err => {
          console.error(`[Scheduler Error] App #${app.id}:`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('[Scheduler Master Tick Error]:', err.message);
  }
}

function startMonitoring() {
  if (masterSchedulerTimer) return;
  console.log('[Monitor] Starting unified master scheduler (1s clock tick)...');
  // Initial immediate probe on all registered apps
  schedulerTick();
  masterSchedulerTimer = setInterval(schedulerTick, TICK_INTERVAL_MS);
}

function stopMonitoring() {
  if (masterSchedulerTimer) {
    clearInterval(masterSchedulerTimer);
    masterSchedulerTimer = null;
    console.log('[Monitor] Master scheduler stopped.');
  }
}

function getAppStatus(appId) {
  return appStates.get(Number(appId)) || null;
}

function getAllAppsStatus() {
  const apps = db.getApplications();
  return apps.map(app => {
    const state = getOrCreateAppState(app);
    return {
      ...app,
      status: state.status,
      lastProbe: state.lastProbe,
      activeIncident: state.activeIncident,
      lastSuccessfulCheck: state.lastSuccessfulCheck,
      consecutiveFailures: state.consecutiveFailures
    };
  });
}

function getGlobalHealthSummary() {
  const allApps = getAllAppsStatus();
  const total = allApps.length;
  const healthy = allApps.filter(a => a.status === 'HEALTHY').length;
  const degraded = allApps.filter(a => a.status === 'DEGRADED').length;
  const down = allApps.filter(a => a.status === 'UNAVAILABLE' || a.status === 'DOWN').length;

  return {
    totalApplications: total,
    healthyApplications: healthy,
    degradedApplications: degraded,
    downApplications: down,
    allHealthy: total > 0 && healthy === total
  };
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  schedulerTick,
  probeApplication,
  getAppStatus,
  getAllAppsStatus,
  getGlobalHealthSummary,
  registerProbeListener,
  injectSyntheticFault,
  clearSyntheticFault,
  getActiveSyntheticFault
};

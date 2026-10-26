const monitor = require('./monitor');
const db = require('./db');
const dockerController = require('./dockerController');

const SCENARIOS = {
  // Scenario 1: Service becomes unavailable (Docker container stop or pause)
  DOCKER_SERVICE_UNAVAILABLE: {
    id: 'DOCKER_SERVICE_UNAVAILABLE',
    name: 'Service Unavailability & Outage Audit',
    category: 'INFRASTRUCTURE_FAILURE',
    description: 'Stops or freezes the dedicated test microservice container. Detects the outage and records the incident.',
    slaThresholdSeconds: 18.0,
    isDestructive: true,
    isSimulated: false,
    dockerAction: 'stop',
    fallbackEndpoint: '/fault/pause',
    fallbackBody: { autoRecoverSeconds: 0 }
  },

  // Scenario 2: Automatic recovery (Restart container)
  AUTO_RECOVERY_TEST: {
    id: 'AUTO_RECOVERY_TEST',
    name: 'Automated Self-Healing & Container Recovery',
    category: 'SELF_HEALING_AUDIT',
    description: 'Injects an internal outage, detects failure, triggers allowlisted container restart, and audits recovery time.',
    slaThresholdSeconds: 15.0,
    isDestructive: false,
    isSimulated: false,
    dockerAction: 'restart',
    fallbackEndpoint: '/fault/error',
    fallbackBody: { message: 'Automated Self-Healing Chaos Test: Downstream Crash', autoRecoverSeconds: 6 }
  },

  // Scenario 3: Simulated storage quota warning
  STORAGE_QUOTA_SIMULATION: {
    id: 'STORAGE_QUOTA_SIMULATION',
    name: 'Simulated Storage Quota Threshold Warning',
    category: 'RESOURCE_QUOTA_SIMULATION',
    description: 'Increases simulated storage usage to 88% (threshold: 80%). Audits quota breach warning and safe remediation.',
    slaThresholdSeconds: 12.0,
    isDestructive: false,
    isSimulated: true,
    simulationNotice: 'LABEL: This is simulated logical storage usage for quota auditing, not actual host disk exhaustion.',
    fallbackEndpoint: '/api/storage/simulate-usage',
    fallbackBody: { usedMb: 880, autoRecoverSeconds: 6 }
  }
};

let activeExperiment = null;

async function runScenario(scenarioKey, appId = 1) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) {
    throw new Error(`Invalid scenario key: "${scenarioKey}". Available: ${Object.keys(SCENARIOS).join(', ')}`);
  }

  if (activeExperiment) {
    throw new Error(`An experiment (${activeExperiment.scenarioName}) is already running! Please wait for it to complete.`);
  }

  const app = db.getApplicationById(appId);
  if (!app) {
    throw new Error(`Target Application #${appId} not found in database.`);
  }

  console.log(`[Chaos Runner] Starting Scenario "${scenario.name}" on App #${app.id} (${app.name})`);
  
  const eventLogs = [];
  const logEvent = (phase, details) => {
    const timestamp = new Date().toISOString();
    eventLogs.push({ phase, timestamp, details });
    console.log(`[Experiment Event] [${phase}] ${details}`);
  };

  const startedAt = new Date().toISOString();
  const startTimeMs = Date.now();

  const isContainerizedTarget = app.id === 1 || (app.base_url && (app.base_url.includes('target-service') || app.base_url.includes(':5001')));

  let executionMode = 'SAFE_PROCESS_SIMULATION';
  if (isContainerizedTarget) {
    const dockerCheck = await dockerController.checkDockerAvailability();
    if (dockerCheck.targetContainerRunning && scenario.dockerAction) {
      executionMode = 'DOCKER_CLI';
    }
  } else {
    // External / Third-party registered application: use synthetic network prober chaos injection
    executionMode = 'SYNTHETIC_PROBER_SIMULATION';
  }

  activeExperiment = {
    appId: app.id,
    appName: app.name,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    startedAt,
    executionMode,
    currentPhase: 'PHASE_1_INJECTION',
    eventLogs
  };

  logEvent('EXPERIMENT_INITIALIZED', `Target: ${app.name} (#${app.id}) | Execution Mode: ${executionMode} | SLA Target: ${scenario.slaThresholdSeconds}s`);

  let injectedTimeMs = null;
  let detectedTimeMs = null;
  let recoveryAttemptedTimeMs = null;
  let verifiedTimeMs = null;

  let injectedAt = null;
  let detectedAt = null;
  let recoveryAttemptedAt = null;
  let verifiedAt = null;

  try {
    // ==========================================
    // PHASE 1: Failure Injected
    // ==========================================
    injectedTimeMs = Date.now();
    injectedAt = new Date().toISOString();
    activeExperiment.injectedAt = injectedAt;

    if (executionMode === 'SYNTHETIC_PROBER_SIMULATION') {
      const faultType = scenario.id === 'STORAGE_QUOTA_SIMULATION' ? 'STORAGE_QUOTA_SIMULATION' : 'OUTAGE';
      const durationSec = scenario.id === 'AUTO_RECOVERY_TEST' ? 8 : 14;
      monitor.injectSyntheticFault(app.id, faultType, durationSec);
      logEvent('PHASE_1_INJECTION', `Injected synthetic network partition / outage for external microservice "${app.name}" (${app.base_url})`);
    } else if (executionMode === 'DOCKER_CLI' && scenario.dockerAction === 'stop') {
      logEvent('PHASE_1_INJECTION', `Executing restricted command: docker stop ${dockerController.ALLOWED_CONTAINER_NAME}`);
      await dockerController.executeRestrictedDockerAction('stop');
    } else if (scenario.id === 'STORAGE_QUOTA_SIMULATION') {
      logEvent('PHASE_1_INJECTION', `Dispatching simulated storage usage to 88% capacity at ${app.base_url}/api/storage/simulate-usage`);
      const res = await fetch(`${app.base_url}/api/storage/simulate-usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario.fallbackBody)
      });
      if (!res.ok) throw new Error(`Target service rejected storage simulation: HTTP ${res.status}`);
    } else {
      // In-process controlled failure hook
      logEvent('PHASE_1_INJECTION', `Dispatching controlled fault hook at ${app.base_url}${scenario.fallbackEndpoint}`);
      const res = await fetch(`${app.base_url}${scenario.fallbackEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario.fallbackBody)
      });
      if (!res.ok) throw new Error(`Target service rejected fault injection: HTTP ${res.status}`);
    }

    activeExperiment.currentPhase = 'PHASE_2_DETECTION';
    logEvent('AWAITING_DETECTION', 'Monitoring prober awaiting failure detection threshold...');

    // ==========================================
    // PHASE 2, 3, 4: Detection, Recovery Attempt & Verification Loop
    // ==========================================
    const auditResult = await new Promise((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        cleanup();
        if (executionMode === 'SYNTHETIC_PROBER_SIMULATION') {
          monitor.clearSyntheticFault(app.id);
        }
        reject(new Error('Experiment timed out after 50 seconds without completing recovery cycle.'));
      }, 50000);

      const cleanup = monitor.registerProbeListener(async (probeRecord, appState, probedApp) => {
        if (probedApp.id !== app.id) return;

        // --- PHASE 2: Failure Detected ---
        if (!detectedTimeMs && (appState.status === 'UNAVAILABLE' || appState.status === 'DOWN' || appState.status === 'DEGRADED')) {
          detectedTimeMs = Date.now();
          detectedAt = new Date().toISOString();
          const mttdSeconds = Number(((detectedTimeMs - injectedTimeMs) / 1000).toFixed(1));

          activeExperiment.detectedAt = detectedAt;
          activeExperiment.mttdSeconds = mttdSeconds;
          activeExperiment.currentPhase = 'PHASE_3_RECOVERY_ATTEMPT';

          logEvent('PHASE_2_DETECTION', `Failure detected by prober in ${mttdSeconds}s (MTTD). Status: ${appState.status}`);

          // --- PHASE 3: Recovery Attempted ---
          recoveryAttemptedTimeMs = Date.now();
          recoveryAttemptedAt = new Date().toISOString();
          activeExperiment.recoveryAttemptedAt = recoveryAttemptedAt;

          logEvent('PHASE_3_RECOVERY_ATTEMPT', 'Initiating allowlisted recovery action...');

          try {
            if (executionMode === 'SYNTHETIC_PROBER_SIMULATION') {
              logEvent('RECOVERY_ACTION', `Restoring synthetic network route / clearing fault for external microservice "${app.name}"`);
              monitor.clearSyntheticFault(app.id);
            } else if (executionMode === 'DOCKER_CLI') {
              const recoveryCmd = scenario.dockerAction === 'stop' ? 'start' : 'restart';
              logEvent('RECOVERY_ACTION', `Executing allowlisted command: docker ${recoveryCmd} ${dockerController.ALLOWED_CONTAINER_NAME}`);
              await dockerController.executeRestrictedDockerAction(recoveryCmd);
            } else if (scenario.id === 'STORAGE_QUOTA_SIMULATION') {
              logEvent('RECOVERY_ACTION', `Resetting simulated storage usage to safe 35% capacity`);
              await fetch(`${app.base_url}/api/storage/reset`, { method: 'POST' });
            } else {
              logEvent('RECOVERY_ACTION', `Sending recovery signal to ${app.base_url}/fault/recover`);
              await fetch(`${app.base_url}/fault/recover`, { method: 'POST' });
            }

            activeExperiment.currentPhase = 'PHASE_4_VERIFICATION';
            logEvent('AWAITING_VERIFICATION', 'Awaiting consecutive healthy probes to confirm recovery...');
          } catch (recErr) {
            logEvent('RECOVERY_ERROR', `Recovery action failed: ${recErr.message}`);
          }
        }

        // --- PHASE 4: Recovery Verified ---
        if (detectedTimeMs && recoveryAttemptedTimeMs && appState.status === 'HEALTHY' && appState.consecutiveSuccesses >= 2) {
          verifiedTimeMs = Date.now();
          verifiedAt = new Date().toISOString();
          clearTimeout(timeoutTimer);
          cleanup();

          const mttdSeconds = Number(((detectedTimeMs - injectedTimeMs) / 1000).toFixed(1));
          const mttrSeconds = Number(((verifiedTimeMs - detectedTimeMs) / 1000).toFixed(1));
          const totalDurationSeconds = Number(((verifiedTimeMs - injectedTimeMs) / 1000).toFixed(1));
          const slaPassed = mttrSeconds <= scenario.slaThresholdSeconds;

          logEvent('PHASE_4_VERIFICATION', `Recovery verified via 2 consecutive healthy probes. MTTR: ${mttrSeconds}s (SLA Target: ${scenario.slaThresholdSeconds}s)`);

          const reportSummary = {
            appId: app.id,
            appName: app.name,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            description: scenario.description,
            executionMode,
            isSimulated: scenario.isSimulated,
            simulationNotice: scenario.simulationNotice || null,
            // 4 Distinct Timestamps:
            injectedAt,
            detectedAt,
            recoveryAttemptedAt,
            verifiedAt,
            // Measurements:
            mttdSeconds,
            mttrSeconds,
            totalDurationSeconds,
            slaThresholdSeconds: scenario.slaThresholdSeconds,
            slaPassed,
            finalOutcome: slaPassed ? 'SUCCESS_SLA_COMPLIANT' : 'SUCCESS_SLA_BREACHED',
            eventLogs
          };

          // Save into SQLite audit_runs
          try {
            const runId = db.saveAuditRun({
              appId: app.id,
              scenarioId: scenario.id,
              scenarioName: scenario.name,
              startedAt,
              completedAt: verifiedAt,
              injectedAt,
              detectedAt,
              recoveryAttemptedAt,
              verifiedAt,
              executionMode,
              mttdSeconds,
              mttrSeconds,
              slaThresholdSeconds: scenario.slaThresholdSeconds,
              slaPassed,
              eventLogs,
              finalOutcome: reportSummary.finalOutcome,
              isSimulated: scenario.isSimulated,
              reportSummary
            });
            reportSummary.auditRunId = runId;

            db.logActivity({
              appId: app.id,
              eventType: 'EXPERIMENT_COMPLETED',
              severity: slaPassed ? 'SUCCESS' : 'ERROR',
              message: `Completed Experiment #${runId}: ${scenario.name} (${reportSummary.finalOutcome})`,
              details: `MTTD: ${mttdSeconds}s | MTTR: ${mttrSeconds}s | Target: ${scenario.slaThresholdSeconds}s | Mode: ${executionMode}`
            });
          } catch (dbErr) {
            console.error('[Chaos Runner] Error persisting audit run:', dbErr.message);
          }

          resolve(reportSummary);
        }
      });
    });

    activeExperiment = null;
    return auditResult;
  } catch (err) {
    activeExperiment = null;
    throw err;
  }
}

function getActiveExperiment() {
  return activeExperiment;
}

function getScenarios() {
  return SCENARIOS;
}

module.exports = {
  runScenario,
  getActiveExperiment,
  getScenarios,
  getScenarioDefinitions: getScenarios,
  SCENARIOS
};

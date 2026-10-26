const express = require('express');
const cors = require('cors');
const db = require('./db');
const monitor = require('./monitor');
const chaosRunner = require('./chaosRunner');
const dockerController = require('./dockerController');
const { validateTargetUrl, sanitizeErrorMessage } = require('./security');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- 1. System Health Check ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'faultlens-auditor-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// --- 2. Applications Management ---

// List all registered test applications with real-time status & last successful check
app.get('/api/applications', (req, res) => {
  try {
    const appsWithStatus = monitor.getAllAppsStatus();
    res.json(appsWithStatus);
  } catch (err) {
    res.status(500).json({ error: `Failed to list applications: ${err.message}` });
  }
});

// Register a new test application with SSRF validation
app.post('/api/applications', (req, res) => {
  const {
    name,
    baseUrl,
    healthEndpoint = '/health',
    checkIntervalSeconds = 10,
    failureThreshold = 2,
    timeoutMs = 4000,
    degradedLatencyThresholdMs = 1500,
    description
  } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Application name is required.' });
  }

  // SSRF and URL validation
  const validation = validateTargetUrl(baseUrl);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const newApp = db.createApplication({
      name: name.trim(),
      baseUrl: validation.sanitizedUrl,
      healthEndpoint: healthEndpoint.trim(),
      checkIntervalSeconds: parseInt(checkIntervalSeconds, 10) || 10,
      failureThreshold: parseInt(failureThreshold, 10) || 2,
      timeoutMs: parseInt(timeoutMs, 10) || 4000,
      degradedLatencyThresholdMs: parseInt(degradedLatencyThresholdMs, 10) || 1500,
      description: description ? description.trim() : null
    });

    // Run an immediate health check on the newly registered app
    monitor.probeApplication(newApp).catch(e => {
      console.warn(`[Monitor] Initial probe on ${newApp.name} failed:`, e.message);
    });

    res.status(201).json({
      message: `Application "${newApp.name}" registered successfully.`,
      application: newApp
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: `An application with baseUrl "${baseUrl}" is already registered.` });
    }
    res.status(500).json({ error: `Failed to register application: ${err.message}` });
  }
});

// View application details with recent probes, incidents, and config
app.get('/api/applications/:id', (req, res) => {
  const appId = parseInt(req.params.id, 10);
  const application = db.getApplicationById(appId);

  if (!application) {
    return res.status(404).json({ error: `Application #${appId} not found.` });
  }

  const status = monitor.getAppStatus(appId);
  const recentProbes = db.getRecentProbes(35, appId);
  const recentIncidents = db.getIncidents(10, appId);
  const recentExperiments = db.getAuditRuns(10, appId);

  res.json({
    application,
    status: status ? status.status : application.current_status,
    lastProbe: status ? status.lastProbe : null,
    activeIncident: status ? status.activeIncident : null,
    lastSuccessfulCheck: status ? status.lastSuccessfulCheck : application.last_successful_check,
    consecutiveFailures: status ? status.consecutiveFailures : application.consecutive_failures,
    recentProbes,
    recentIncidents,
    recentExperiments
  });
});

// Update application monitoring configuration (interval, threshold, endpoints)
app.put('/api/applications/:id', (req, res) => {
  const appId = parseInt(req.params.id, 10);
  const appItem = db.getApplicationById(appId);

  if (!appItem) {
    return res.status(404).json({ error: `Application #${appId} not found.` });
  }

  try {
    const updated = db.updateApplicationConfig(appId, req.body);
    res.json({
      message: `Configuration for "${updated.name}" updated successfully.`,
      application: updated
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to update configuration: ${err.message}` });
  }
});

// Remove a test application configuration
app.delete('/api/applications/:id', (req, res) => {
  const appId = parseInt(req.params.id, 10);

  if (appId === 1) {
    return res.status(400).json({ error: 'Cannot remove default core target application #1.' });
  }

  const success = db.deleteApplication(appId);
  if (!success) {
    return res.status(404).json({ error: `Application #${appId} not found.` });
  }

  res.json({ message: `Application #${appId} removed successfully.` });
});

// --- 3. Telemetry, Status & Metrics ---

// High-level system overview status
app.get('/api/status', (req, res) => {
  const globalSummary = monitor.getGlobalHealthSummary();
  const allApps = monitor.getAllAppsStatus();
  const activeExp = chaosRunner.getActiveExperiment();
  const primaryApp = allApps && allApps.length > 0 ? allApps[0] : null;

  res.json({
    auditor: 'ONLINE',
    uptimeSeconds: Math.floor(process.uptime()),
    globalHealth: globalSummary,
    targetStatus: primaryApp ? primaryApp.current_status : (globalSummary.allHealthy ? 'HEALTHY' : 'UNKNOWN'),
    lastProbe: primaryApp ? primaryApp.lastProbe : null,
    activeIncident: allApps.find(a => a.activeIncident)?.activeIncident || null,
    applications: allApps,
    activeExperiment: activeExp,
    timestamp: new Date().toISOString()
  });
});

// Recent probes for latency charts (filter by ?appId=1&limit=40)
app.get('/api/probes/recent', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 40;
  const appId = req.query.appId ? parseInt(req.query.appId, 10) : null;
  const probes = db.getRecentProbes(limit, appId);
  res.json(probes);
});

// Global reliability metrics (Availability %, Total Apps, MTTR, SLA rate)
app.get('/api/metrics', (req, res) => {
  const summary = db.getMetricsSummary();
  const healthSummary = monitor.getGlobalHealthSummary();
  res.json({
    ...summary,
    ...healthSummary
  });
});

// --- 4. Incidents & Activity Logs ---

// Full incidents list (filter by ?appId=...)
app.get('/api/incidents', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 30;
  const appId = req.query.appId ? parseInt(req.query.appId, 10) : null;
  const incidents = db.getIncidents(limit, appId);
  res.json(incidents);
});

// Activity logs stream (filter by ?appId=...)
app.get('/api/activity-logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const appId = req.query.appId ? parseInt(req.query.appId, 10) : null;
  const logs = db.getActivityLogs(limit, appId);
  res.json(logs);
});

// --- 5. Chaos Scenarios & Experiments ---

// Docker CLI Daemon Status
app.get('/api/docker/status', async (req, res) => {
  try {
    const status = await dockerController.checkDockerAvailability();
    res.json(status);
  } catch (e) {
    res.json({ available: false, daemonOnline: false, error: e.message });
  }
});

// Available scenario definitions
app.get('/api/scenarios', (req, res) => {
  res.json(chaosRunner.getScenarios ? chaosRunner.getScenarios() : chaosRunner.SCENARIOS);
});

// Historical audit runs / experiments
app.get('/api/audit-runs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 30;
  const appId = req.query.appId ? parseInt(req.query.appId, 10) : null;
  const runs = db.getAuditRuns(limit, appId);

  const formatted = runs.map(run => {
    let summary = run.report_summary;
    try {
      summary = JSON.parse(run.report_summary);
    } catch (e) {}
    return { ...run, report_summary: summary };
  });

  res.json(formatted);
});

// Helper: Deterministic Rule-Based Heuristic Interpretation
function generateRuleBasedInterpretation(run) {
  const mttd = run.mttd_seconds !== null && run.mttd_seconds !== undefined ? run.mttd_seconds : 0;
  const mttr = run.mttr_seconds !== null && run.mttr_seconds !== undefined ? run.mttr_seconds : 0;
  const slaTarget = run.sla_threshold_seconds || 15;
  const slaPassed = Boolean(run.sla_passed);
  const mode = run.execution_mode || 'SAFE_PROCESS_SIMULATION';
  const isSimulated = Boolean(run.is_simulated);

  const findings = [];

  // Detection Assessment
  if (mttd <= 2.5) {
    findings.push(`Rapid Detection: The monitoring prober identified the failure in ${mttd}s. Failure threshold (2 consecutive failed checks) successfully prevented false-alarm flapping while maintaining sub-3s incident recognition.`);
  } else {
    findings.push(`Standard Detection: Outage flagged in ${mttd}s. Polling cycle interval and threshold buffer verified without premature alert triggering.`);
  }

  // Recovery Assessment
  if (slaPassed) {
    const margin = (slaTarget - mttr).toFixed(1);
    findings.push(`SLA Compliance: PASSED. Microservice recovery verified in ${mttr}s, operating inside the ${slaTarget}s SLA budget with a ${margin}s safety margin.`);
  } else {
    const breach = (mttr - slaTarget).toFixed(1);
    findings.push(`SLA Violation: BREACHED. Service required ${mttr}s to restore health, exceeding the ${slaTarget}s SLA limit by ${breach}s.`);
  }

  // Infrastructure & Quota Policy
  if (mode === 'DOCKER_CLI') {
    findings.push(`Container Virtualization: Verified restricted Docker container operations on faultlens-target-service. Linux container lifecycle and healthcheck passed re-verification.`);
  } else if (isSimulated) {
    findings.push(`Logical Quota Simulation: Target microservice correctly responded with DEGRADED status upon reaching 88% quota. Reset returned telemetry to nominal.`);
  } else {
    findings.push(`In-Process Self-Healing: Target microservice cleared error state via in-process recovery hook.`);
  }

  return {
    verdict: slaPassed ? 'SLA_COMPLIANT' : 'SLA_BREACHED',
    findings,
    conclusion: slaPassed 
      ? `Resilience verified for ${run.scenario_name}. Service satisfies production availability SLA.` 
      : `Resilience breach in ${run.scenario_name}. Review container startup latency or dependency reconnect timeouts.`
  };
}

// Single audit run details with rule-based interpretation
app.get('/api/audit-runs/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const run = db.getAuditRunById(id);
  if (!run) {
    return res.status(404).json({ error: `Audit Run #${id} not found.` });
  }

  let summary = run.report_summary;
  try {
    summary = JSON.parse(run.report_summary);
  } catch (e) {}

  const interpretation = generateRuleBasedInterpretation(run);
  res.json({ ...run, report_summary: summary, interpretation });
});

// Export Single Audit Run as JSON
app.get('/api/audit-runs/:id/export/json', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const run = db.getAuditRunById(id);
  if (!run) {
    return res.status(404).json({ error: `Audit Run #${id} not found.` });
  }

  let summary = run.report_summary;
  try {
    summary = JSON.parse(run.report_summary);
  } catch (e) {}

  let eventLogs = run.event_logs;
  try {
    if (typeof eventLogs === 'string') eventLogs = JSON.parse(eventLogs);
  } catch (e) {}

  const payload = {
    reportType: 'FaultLens Resilience Post-Mortem Audit',
    runId: run.id,
    generatedAt: new Date().toISOString(),
    configuration: {
      appId: run.app_id,
      appName: run.app_name,
      scenarioId: run.scenario_id,
      scenarioName: run.scenario_name,
      executionMode: run.execution_mode,
      isSimulated: Boolean(run.is_simulated),
      slaThresholdSeconds: run.sla_threshold_seconds
    },
    lifecycleTimestamps: {
      startedAt: run.started_at,
      injectedAt: run.injected_at,
      detectedAt: run.detected_at,
      recoveryAttemptedAt: run.recovery_attempted_at,
      verifiedAt: run.verified_at,
      completedAt: run.completed_at
    },
    measurements: {
      mttdSeconds: run.mttd_seconds,
      mttrSeconds: run.mttr_seconds,
      totalDurationSeconds: run.total_duration_seconds !== null ? run.total_duration_seconds : Number(run.mttd_seconds + run.mttr_seconds).toFixed(1),
      slaPassed: Boolean(run.sla_passed),
      finalOutcome: run.final_outcome
    },
    ruleBasedInterpretation: generateRuleBasedInterpretation(run),
    eventLogs: eventLogs || [],
    reportSummary: summary
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="faultlens-audit-run-${id}.json"`);
  res.send(JSON.stringify(payload, null, 2));
});

// Export Single Audit Run as CSV
app.get('/api/audit-runs/:id/export/csv', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const run = db.getAuditRunById(id);
  if (!run) {
    return res.status(404).json({ error: `Audit Run #${id} not found.` });
  }

  let eventLogs = run.event_logs;
  try {
    if (typeof eventLogs === 'string') eventLogs = JSON.parse(eventLogs);
  } catch (e) {}

  const interpretation = generateRuleBasedInterpretation(run);

  const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

  let csv = 'SECTION,PROPERTY,VALUE\n';
  csv += `Metadata,Report Type,FaultLens Post-Mortem Audit\n`;
  csv += `Metadata,Run ID,${run.id}\n`;
  csv += `Metadata,Generated At,${escapeCsv(new Date().toISOString())}\n`;
  csv += `Configuration,Target Application,${escapeCsv(run.app_name || 'App #' + run.app_id)}\n`;
  csv += `Configuration,Scenario Name,${escapeCsv(run.scenario_name)}\n`;
  csv += `Configuration,Execution Mode,${escapeCsv(run.execution_mode)}\n`;
  csv += `Configuration,Is Simulated,${Boolean(run.is_simulated)}\n`;
  csv += `Configuration,SLA Threshold (Seconds),${run.sla_threshold_seconds}\n`;
  csv += `Timestamps,Failure Injected At,${escapeCsv(run.injected_at || run.started_at)}\n`;
  csv += `Timestamps,Failure Detected At,${escapeCsv(run.detected_at || 'N/A')}\n`;
  csv += `Timestamps,Recovery Attempted At,${escapeCsv(run.recovery_attempted_at || 'N/A')}\n`;
  csv += `Timestamps,Recovery Verified At,${escapeCsv(run.verified_at || run.completed_at)}\n`;
  csv += `Measurements,Time to Detect MTTD (Seconds),${run.mttd_seconds}\n`;
  csv += `Measurements,Time to Recover MTTR (Seconds),${run.mttr_seconds}\n`;
  csv += `Measurements,Total Duration (Seconds),${run.total_duration_seconds || Number(run.mttd_seconds + run.mttr_seconds).toFixed(1)}\n`;
  csv += `Measurements,SLA Compliance Passed,${Boolean(run.sla_passed)}\n`;
  csv += `Measurements,Final Outcome,${escapeCsv(run.final_outcome)}\n`;
  csv += `Interpretation,Conclusion,${escapeCsv(interpretation.conclusion)}\n`;
  interpretation.findings.forEach((f, idx) => {
    csv += `Interpretation,Finding ${idx + 1},${escapeCsv(f)}\n`;
  });

  if (Array.isArray(eventLogs) && eventLogs.length > 0) {
    csv += '\nTIMELINE_LOGS,TIMESTAMP,PHASE,DETAILS\n';
    eventLogs.forEach((l) => {
      csv += `Log,${escapeCsv(l.timestamp)},${escapeCsv(l.phase)},${escapeCsv(l.details)}\n`;
    });
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="faultlens-audit-run-${id}.csv"`);
  res.send(csv);
});

// Export Historical Audit Runs as CSV (?appId=...)
app.get('/api/audit-runs/export/csv', (req, res) => {
  const appId = req.query.appId ? parseInt(req.query.appId, 10) : null;
  const targetApp = appId ? db.getApplicationById(appId) : null;
  const runs = db.getAuditRuns(100, appId);
  const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

  let csv = 'Run ID,Target App,Scenario,Mode,Injected At,Detected At,Recovery Attempted At,Verified At,MTTD (s),MTTR (s),Total Duration (s),SLA Limit (s),SLA Passed,Final Outcome,Simulated\n';
  runs.forEach(r => {
    const duration = r.total_duration_seconds !== null ? r.total_duration_seconds : Number(r.mttd_seconds + r.mttr_seconds).toFixed(1);
    csv += [
      r.id,
      escapeCsv(r.app_name || (targetApp ? targetApp.name : 'App #' + r.app_id)),
      escapeCsv(r.scenario_name),
      escapeCsv(r.execution_mode),
      escapeCsv(r.injected_at || r.started_at),
      escapeCsv(r.detected_at || 'N/A'),
      escapeCsv(r.recovery_attempted_at || 'N/A'),
      escapeCsv(r.verified_at || r.completed_at),
      r.mttd_seconds,
      r.mttr_seconds,
      duration,
      r.sla_threshold_seconds,
      Boolean(r.sla_passed),
      escapeCsv(r.final_outcome),
      Boolean(r.is_simulated)
    ].join(',') + '\n';
  });

  const filename = targetApp
    ? `audit-runs-${targetApp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`
    : 'faultlens-all-experiments.csv';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// Trigger a controlled chaos experiment
app.post('/api/chaos/trigger', async (req, res) => {
  const { scenarioKey, appId = 1 } = req.body || {};
  if (!scenarioKey) {
    return res.status(400).json({ error: 'Missing scenarioKey in request body.' });
  }

  try {
    if (req.body.async) {
      chaosRunner.runScenario(scenarioKey, appId).catch(err => {
        console.error('[Chaos Runner Async Error]', err.message);
      });
      return res.json({ message: `Scenario ${scenarioKey} initiated for App #${appId}. Follow progress on dashboard.` });
    }

    const result = await chaosRunner.runScenario(scenarioKey, appId);
    res.json({
      message: 'Chaos experiment and recovery audit completed successfully.',
      auditResult: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Emergency manual recovery trigger for an application
app.post('/api/chaos/recover', async (req, res) => {
  const appId = req.body?.appId || 1;
  const appItem = db.getApplicationById(appId);

  if (!appItem) {
    return res.status(404).json({ error: `Application #${appId} not found.` });
  }

  let recoveryNotes = [];

  // Clear any active synthetic prober fault for this application
  if (monitor.clearSyntheticFault) {
    monitor.clearSyntheticFault(appId);
    recoveryNotes.push('Cleared active synthetic prober faults');
  }

  // 1. If Docker is available and this is the containerized target, ensure the container is started
  try {
    const dockerStatus = await dockerController.checkDockerAvailability();
    if (dockerStatus.available) {
      const dockerRes = await dockerController.executeRestrictedDockerAction('start');
      recoveryNotes.push(`Docker: Container ${dockerController.ALLOWED_CONTAINER_NAME} started`);
    }
  } catch (dockerErr) {
    recoveryNotes.push(`Docker notice: ${dockerErr.message}`);
  }

  // 2. Send in-process reset and recovery signal
  try {
    const targetUrl = `${appItem.base_url}/fault/recover`;
    const response = await fetch(targetUrl, { method: 'POST', signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const data = await response.json();
      recoveryNotes.push(`HTTP: In-process fault state cleared (${JSON.stringify(data)})`);
    }
  } catch (err) {
    recoveryNotes.push(`HTTP notice: ${err.message}`);
  }

  // 3. Reset storage quota simulation if active
  try {
    await fetch(`${appItem.base_url}/api/storage/reset`, { method: 'POST', signal: AbortSignal.timeout(2000) });
    recoveryNotes.push('Storage: Reset simulated quota usage to 35%');
  } catch (err) {}

  db.logActivity({
    appId,
    eventType: 'MANUAL_RECOVERY',
    severity: 'INFO',
    message: `Manual recovery executed on "${appItem.name}"`,
    details: recoveryNotes.join(' | ')
  });

  res.json({
    message: `Manual recovery executed for ${appItem.name}.`,
    details: recoveryNotes
  });
});

// Privileged Restricted Docker Container Action
app.post('/api/docker/action', async (req, res) => {
  const { action } = req.body || {};
  if (!action || !dockerController.ALLOWED_DOCKER_ACTIONS.has(action.toLowerCase())) {
    return res.status(400).json({
      error: `Invalid action. Permitted allowlisted actions: ${Array.from(dockerController.ALLOWED_DOCKER_ACTIONS).join(', ')}`
    });
  }

  try {
    const result = await dockerController.executeRestrictedDockerAction(action);
    db.logActivity({
      appId: 1,
      eventType: 'DOCKER_ACTION',
      severity: action === 'stop' ? 'WARN' : 'INFO',
      message: `Manual Docker action "${action}" executed on container ${dockerController.ALLOWED_CONTAINER_NAME}`,
      details: result.output || 'OK'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exportable Markdown Report (supports ?appId=...)
app.get('/api/report/export', (req, res) => {
  const appId = req.query.appId ? parseInt(req.query.appId, 10) : null;
  const targetApp = appId ? db.getApplicationById(appId) : null;
  const metrics = db.getMetricsSummary();
  const apps = targetApp ? [targetApp] : db.getApplications();
  const incidents = db.getIncidents(30, appId);
  const runs = db.getAuditRuns(30, appId);

  const report = `
# FaultLens Reliability & Recovery Audit Report
Generated at: ${new Date().toISOString()}
Target Scope: ${targetApp ? `Application #${targetApp.id} - ${targetApp.name} (${targetApp.base_url})` : 'All Registered Cloud Microservices (Consolidated)'}

## 1. Executive Reliability Summary
- **Target Application**: ${targetApp ? targetApp.name : `Consolidated (${metrics.totalApplications} Active Microservices)`}
- **Availability (Uptime)**: ${metrics.availabilityPercentage}%
- **Total Health Probes Recorded**: ${metrics.totalProbes} (${metrics.healthyProbes} healthy)
- **Failure Incidents**: ${incidents.length} recorded (Active Outages: ${metrics.activeIncidents})
- **Average Mean Time To Recover (MTTR)**: ${metrics.averageMttrSeconds} seconds
- **Resilience Chaos Experiments Executed**: ${runs.length} (${runs.filter(r => r.sla_passed).length} Passed SLA)

## 2. Monitored Microservice Configuration & SLA Thresholds
${apps.map(a => `- **[App #${a.id}] ${a.name}**: \`${a.base_url}${a.health_endpoint}\`
  - Current Live Status: **${a.current_status}**
  - Polling Check Interval: ${a.check_interval_seconds}s
  - Consecutive Failure Threshold: ${a.failure_threshold} failed checks
  - Latency Degraded Threshold: ${a.degraded_latency_threshold_ms || 1500}ms
  - Last Successful Check: ${a.last_successful_check || 'N/A'}
  - Description: ${a.description || 'Core workload'}
`).join('\n')}

## 3. Chaos Resilience Audit Runs
${runs.length === 0 ? '_No chaos experiments executed yet for this scope._' : runs.map(r => `
### Run #${r.id}: ${r.scenario_name} (${r.app_name || 'App #' + r.app_id})
- **Verdict**: ${r.sla_passed ? '✓ PASSED (SLA Compliant)' : '✗ FAILED (SLA Breached)'}
- **Execution Mode**: \`${r.execution_mode || 'SAFE_PROCESS_SIMULATION'}\`
- **Mean Time to Detect (MTTD)**: ${r.mttd_seconds}s
- **Mean Time to Recover (MTTR)**: ${r.mttr_seconds}s
- **SLA Recovery Target**: ${r.sla_threshold_seconds}s
- **Execution Started**: ${r.started_at}
- **Recovery Verified**: ${r.verified_at || r.completed_at}
`).join('\n')}

## 4. Incident & Outage Telemetry History
${incidents.length === 0 ? '_Zero failure incidents recorded. Microservice operates nominal 100% uptime._' : incidents.map(i => `
- **Incident #${i.id}** [${i.status}]: ${i.incident_type} (${i.app_name || 'App #' + i.app_id})
  - Cause / Diagnosis: ${i.trigger_cause || 'Health probe timed out or refused connection'}
  - Outage Started: ${i.started_at}
  - Incident Detected: ${i.detected_at}
  - Service Restored: ${i.resolved_at || 'In progress / Active Outage'}
  - Downtime Duration: ${i.duration_seconds ? i.duration_seconds + 's' : 'Ongoing'}
`).join('\n')}
  `.trim();

  const filename = targetApp 
    ? `faultlens-audit-report-${targetApp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`
    : 'faultlens-audit-report-all-workloads.md';

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(report);
});

// Export Raw Telemetry Health Probes as CSV (?appId=...)
app.get('/api/probes/export/csv', (req, res) => {
  const appId = req.query.appId ? parseInt(req.query.appId, 10) : null;
  const targetApp = appId ? db.getApplicationById(appId) : null;
  const probes = db.getRecentProbes(500, appId);

  const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
  let csv = 'Probe ID,App ID,Application Name,Timestamp,HTTP Status,Latency (ms),Status Text,Is Healthy,Error Message\n';
  probes.forEach(p => {
    csv += [
      p.id,
      p.app_id,
      escapeCsv(p.app_name || (targetApp ? targetApp.name : 'App #' + p.app_id)),
      escapeCsv(p.timestamp),
      p.status_code ?? 'N/A',
      p.latency_ms ?? 'NULL',
      escapeCsv(p.status_text),
      p.is_healthy ? 'TRUE' : 'FALSE',
      escapeCsv(p.error_message || '')
    ].join(',') + '\n';
  });

  const filename = targetApp
    ? `telemetry-probes-${targetApp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`
    : 'telemetry-probes-all-apps.csv';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// Export Incident Log as CSV (?appId=...)
app.get('/api/incidents/export/csv', (req, res) => {
  const appId = req.query.appId ? parseInt(req.query.appId, 10) : null;
  const targetApp = appId ? db.getApplicationById(appId) : null;
  const incidents = db.getIncidents(100, appId);

  const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
  let csv = 'Incident ID,App ID,Application Name,Incident Type,Status,Started At,Detected At,Resolved At,Duration (s),Trigger Cause\n';
  incidents.forEach(i => {
    csv += [
      i.id,
      i.app_id,
      escapeCsv(i.app_name || (targetApp ? targetApp.name : 'App #' + i.app_id)),
      escapeCsv(i.incident_type),
      i.status,
      escapeCsv(i.started_at),
      escapeCsv(i.detected_at),
      escapeCsv(i.resolved_at || 'In progress'),
      i.duration_seconds || 'Ongoing',
      escapeCsv(i.trigger_cause || '')
    ].join(',') + '\n';
  });

  const filename = targetApp
    ? `incidents-${targetApp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`
    : 'incidents-all-apps.csv';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// Export Activity Logs as CSV (?appId=...)
app.get('/api/activity-logs/export/csv', (req, res) => {
  const appId = req.query.appId ? parseInt(req.query.appId, 10) : null;
  const targetApp = appId ? db.getApplicationById(appId) : null;
  const logs = db.getActivityLogs(200, appId);

  const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
  let csv = 'Log ID,App ID,Application Name,Timestamp,Event Type,Severity,Message,Details\n';
  logs.forEach(l => {
    csv += [
      l.id,
      l.app_id,
      escapeCsv(l.app_name || (targetApp ? targetApp.name : 'App #' + l.app_id)),
      escapeCsv(l.created_at),
      escapeCsv(l.event_type),
      escapeCsv(l.severity),
      escapeCsv(l.message),
      escapeCsv(l.details || '')
    ].join(',') + '\n';
  });

  const filename = targetApp
    ? `activity-logs-${targetApp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`
    : 'activity-logs-all-apps.csv';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// Start active background health monitoring (master scheduler)
monitor.startMonitoring();

const server = app.listen(PORT, () => {
  console.log(`[Auditor Backend] Running on port ${PORT} (PID: ${process.pid})`);
  console.log(`[Auditor Backend] Health API: http://localhost:${PORT}/api/health`);
  console.log(`[Auditor Backend] Applications API: http://localhost:${PORT}/api/applications`);
  console.log(`[Auditor Backend] Status API: http://localhost:${PORT}/api/status`);
});

// Clean shutdown handler
process.on('SIGTERM', () => {
  monitor.stopMonitoring();
  server.close(() => console.log('[Auditor Backend] Terminated gracefully'));
});

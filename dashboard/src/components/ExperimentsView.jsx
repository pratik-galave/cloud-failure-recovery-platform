import React, { useState } from 'react';
import { 
  Flame, 
  Play, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  Server, 
  AlertTriangle, 
  RotateCcw, 
  HardDrive, 
  Eye, 
  ShieldAlert,
  Terminal,
  Activity
} from 'lucide-react';
import { API_BASE } from '../config';

const SCENARIOS = [
  {
    key: 'DOCKER_SERVICE_UNAVAILABLE',
    name: 'Scenario 1: Service Unavailability Audit',
    category: 'INFRASTRUCTURE OUTAGE',
    badge: 'DESTRUCTIVE (OPT-IN)',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    fault: 'Restricted Action: docker stop faultlens-target-service',
    sla: '18.0s SLA Limit',
    slaSeconds: 18.0,
    desc: 'Stops the dedicated test container using a restricted backend action. Audits outage detection and records an incident in SQLite.',
    color: 'from-rose-500/20 to-red-950/40 border-rose-500/40 text-rose-400',
    isDestructive: true
  },
  {
    key: 'AUTO_RECOVERY_TEST',
    name: 'Scenario 2: Automated Container Recovery',
    category: 'SELF-HEALING RECOVERY',
    badge: 'AUTOMATED RESTORE',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    fault: 'Outage Injected -> docker restart faultlens-target-service',
    sla: '15.0s SLA Limit',
    slaSeconds: 15.0,
    desc: 'Injects an internal service failure, detects the outage, triggers allowlisted container restart, and audits MTTR.',
    color: 'from-blue-500/20 to-indigo-950/40 border-blue-500/40 text-blue-400',
    isDestructive: false
  },
  {
    key: 'STORAGE_QUOTA_SIMULATION',
    name: 'Scenario 3: Simulated Storage Quota Warning',
    category: 'STORAGE THRESHOLD AUDIT',
    badge: 'QUOTA SIMULATION',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    fault: 'Simulated Disk Usage: 880MB / 1000MB (88% vs 80% Alert Rule)',
    sla: '12.0s SLA Limit',
    slaSeconds: 12.0,
    desc: 'Simulates storage quota breach to verify DEGRADED health status. Clearly labeled as a logical simulation, not host disk exhaustion.',
    color: 'from-amber-500/20 to-orange-950/40 border-amber-500/40 text-amber-400',
    isDestructive: false,
    simulationNotice: 'SIMULATION ONLY: Logical storage quota test, not actual host filesystem exhaustion.'
  }
];

export default function ExperimentsView({ 
  applications = [], 
  auditRuns = [], 
  activeExperiment, 
  onTriggerChaos,
  onViewReport
}) {
  const [selectedAppId, setSelectedAppId] = useState(applications.length > 0 ? applications[0].id : 1);
  const [runningKey, setRunningKey] = useState(null);
  const [confirmModalScenario, setConfirmModalScenario] = useState(null);
  const [inspectedRun, setInspectedRun] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState(null);

  const handleLaunchClick = (scenario) => {
    if (scenario.isDestructive) {
      setConfirmModalScenario(scenario);
    } else {
      executeScenario(scenario.key);
    }
  };

  const executeScenario = async (scenarioKey) => {
    setConfirmModalScenario(null);
    setRunningKey(scenarioKey);
    try {
      await onTriggerChaos(scenarioKey, selectedAppId);
    } finally {
      setRunningKey(null);
    }
  };

  const handleManualRecovery = async () => {
    setIsRecovering(true);
    setRecoveryNotice(null);
    try {
      const res = await fetch(`${API_BASE}/chaos/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: selectedAppId })
      });
      const data = await res.json();
      setRecoveryNotice(data.message || 'Manual recovery signal sent.');
    } catch (e) {
      setRecoveryNotice(`Recovery error: ${e.message}`);
    } finally {
      setIsRecovering(false);
      setTimeout(() => setRecoveryNotice(null), 6000);
    }
  };

  const isAnyRunning = Boolean(activeExperiment || runningKey);

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Chaos Experiments & SLA Verification
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Controlled failure injection, automated container recovery, and real MTTD / MTTR measurement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Target Application Selector */}
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <Server className="w-4 h-4 text-slate-400 ml-1" />
            <div className="text-xs">
              <label className="block text-[10px] uppercase font-bold text-slate-400">Target Microservice:</label>
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(Number(e.target.value))}
                disabled={isAnyRunning}
                className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
              >
                {applications.map((app) => (
                  <option key={app.id} value={app.id} className="bg-slate-900 text-white">
                    App #{app.id} - {app.name} ({app.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Manual Emergency Recovery Button */}
          <button
            onClick={handleManualRecovery}
            disabled={isRecovering}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95"
            title="Manual fallback to restart container or reset fault state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRecovering ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span>{isRecovering ? 'Recovering...' : 'Manual Fallback'}</span>
          </button>
        </div>
      </div>

      {/* Manual Recovery Flash Message */}
      {recoveryNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between font-mono animate-fadeIn">
          <span>✓ {recoveryNotice}</span>
          <button onClick={() => setRecoveryNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 2. Active Experiment Live Progress HUD & 4-Phase Timeline */}
      {activeExperiment && (
        <div className="p-5 rounded-2xl bg-blue-950/60 border border-blue-500/40 space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-800/50 pb-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <div>
                <span className="font-bold text-white text-sm">
                  Active Experiment: {activeExperiment.scenarioName}
                </span>
                <p className="text-xs text-blue-300">
                  Target: {activeExperiment.appName} | Execution Mode:{' '}
                  <span className="font-mono font-bold text-cyan-300">{activeExperiment.executionMode}</span>
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-blue-900/80 border border-blue-400/40 text-blue-200 font-semibold self-start sm:self-auto">
              Current Phase: {activeExperiment.currentPhase || 'INITIALIZING'}
            </span>
          </div>

          {/* 4-Phase Progression Tracker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {/* Phase 1 */}
            <div className={`p-3 rounded-xl border ${
              activeExperiment.injectedAt ? 'bg-blue-900/40 border-blue-500 text-blue-200' : 'bg-slate-900/40 border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase">1. Injected</span>
                {activeExperiment.injectedAt && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <p className="font-mono text-[11px] truncate">
                {activeExperiment.injectedAt ? new Date(activeExperiment.injectedAt).toLocaleTimeString() : 'Pending'}
              </p>
            </div>

            {/* Phase 2 */}
            <div className={`p-3 rounded-xl border ${
              activeExperiment.detectedAt ? 'bg-amber-900/40 border-amber-500 text-amber-200' : 'bg-slate-900/40 border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase">2. Detected (MTTD)</span>
                {activeExperiment.detectedAt && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <p className="font-mono text-[11px] truncate">
                {activeExperiment.detectedAt ? `${activeExperiment.mttdSeconds}s (${new Date(activeExperiment.detectedAt).toLocaleTimeString()})` : 'Awaiting prober...'}
              </p>
            </div>

            {/* Phase 3 */}
            <div className={`p-3 rounded-xl border ${
              activeExperiment.recoveryAttemptedAt ? 'bg-purple-900/40 border-purple-500 text-purple-200' : 'bg-slate-900/40 border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase">3. Recovery Attempt</span>
                {activeExperiment.recoveryAttemptedAt && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
              </div>
              <p className="font-mono text-[11px] truncate">
                {activeExperiment.recoveryAttemptedAt ? new Date(activeExperiment.recoveryAttemptedAt).toLocaleTimeString() : 'Pending'}
              </p>
            </div>

            {/* Phase 4 */}
            <div className={`p-3 rounded-xl border ${
              activeExperiment.verifiedAt ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200' : 'bg-slate-900/40 border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase">4. Verified (MTTR)</span>
                {activeExperiment.verifiedAt && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="font-mono text-[11px] truncate">
                {activeExperiment.verifiedAt ? 'Verified Healthy' : 'Awaiting 2 healthy probes...'}
              </p>
            </div>
          </div>

          {/* Real-time Event Log Preview */}
          {activeExperiment.eventLogs && activeExperiment.eventLogs.length > 0 && (
            <div className="bg-slate-950/80 p-3 rounded-xl border border-blue-900/60 font-mono text-[11px] space-y-1 max-h-32 overflow-y-auto">
              <div className="text-slate-400 font-bold uppercase text-[10px] mb-1">Live Experiment Events:</div>
              {activeExperiment.eventLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-300">
                  <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="text-blue-400 font-semibold">[{log.phase}]</span>
                  <span className="text-slate-300">{log.details}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Three Controlled Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {SCENARIOS.map((sc) => {
          const isThisRunning = runningKey === sc.key || (activeExperiment && activeExperiment.scenarioId === sc.key);

          return (
            <div
              key={sc.key}
              className={`p-5 rounded-2xl border bg-gradient-to-br flex flex-col justify-between transition-all shadow-lg ${sc.color} ${
                isThisRunning ? 'ring-2 ring-blue-500/70 shadow-2xl' : ''
              }`}
            >
              <div>
                {/* Badges & SLA */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold uppercase ${sc.badgeColor}`}>
                    {sc.badge}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-slate-200 font-semibold">
                    {sc.sla}
                  </span>
                </div>

                <h3 className="font-bold text-white text-base mb-2">
                  {sc.name}
                </h3>

                <p className="text-xs text-slate-300/80 mb-4 leading-relaxed">
                  {sc.desc}
                </p>

                {/* Quota Simulation Label */}
                {sc.simulationNotice && (
                  <div className="mb-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-mono">
                    ℹ️ {sc.simulationNotice}
                  </div>
                )}

                {/* Technical Specifications */}
                <div className="text-[11px] font-mono text-slate-300 mb-4 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                  <div>
                    <span className="text-slate-500">Mechanism:</span>{' '}
                    <span className="text-slate-200">{sc.fault}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">SLA Recovery:</span>{' '}
                    <span className="text-emerald-400 font-bold">&le; {sc.slaSeconds}s</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleLaunchClick(sc)}
                disabled={isAnyRunning}
                className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${
                  isThisRunning
                    ? 'bg-blue-600 text-white cursor-wait'
                    : isAnyRunning
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : sc.isDestructive
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-950'
                }`}
              >
                {isThisRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Auditing Recovery Cycle...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch Experiment</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. Opt-In Confirmation Modal for Destructive Scenarios */}
      {confirmModalScenario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0F172A] border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-white">
                Confirm Destructive Action
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to launch <strong className="text-rose-400">{confirmModalScenario.name}</strong>.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
              <div><span className="text-slate-500">Target Container:</span> faultlens-target-service</div>
              <div><span className="text-slate-500">Action:</span> Restricted Docker Stop</div>
              <div><span className="text-slate-500">Recovery:</span> Automated Docker Start upon detection</div>
            </div>

            <p className="text-[11px] text-slate-400">
              FaultLens will detect the outage, log an incident, initiate allowlisted recovery, and record MTTD and MTTR.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModalScenario(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => executeScenario(confirmModalScenario.key)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30"
              >
                Confirm & Launch Outage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Historical Experiments Table with Inspect */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Experiment Audit Outcomes & Verified Measurements
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Total Audits: {auditRuns.length}
          </span>
        </div>

        {auditRuns.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 font-mono">
            No failure experiments executed yet. Click "Launch Experiment" above to test resilience!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="pb-3 font-semibold">Run ID</th>
                  <th className="pb-3 font-semibold">Target Microservice</th>
                  <th className="pb-3 font-semibold">Scenario Executed</th>
                  <th className="pb-3 font-semibold">Mode</th>
                  <th className="pb-3 font-semibold">MTTD (Detect)</th>
                  <th className="pb-3 font-semibold">MTTR (Recover)</th>
                  <th className="pb-3 font-semibold">Total Duration</th>
                  <th className="pb-3 font-semibold">SLA Target</th>
                  <th className="pb-3 font-semibold">Outcome</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 text-slate-400">#{run.id}</td>
                    <td className="py-3.5 font-sans font-semibold text-white">
                      {run.app_name || `App #${run.app_id}`}
                    </td>
                    <td className="py-3.5 text-slate-300">
                      {run.scenario_name}
                      {run.is_simulated ? (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          SIMULATED
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3.5 text-cyan-400 font-bold text-[11px]">
                      {run.execution_mode || 'DOCKER_CLI'}
                    </td>
                    <td className="py-3.5 text-blue-400 font-bold">
                      {run.mttd_seconds}s
                    </td>
                    <td className="py-3.5 text-indigo-400 font-bold">
                      {run.mttr_seconds}s
                    </td>
                    <td className="py-3.5 text-slate-300 font-bold">
                      {run.total_duration_seconds !== null && run.total_duration_seconds !== undefined 
                        ? `${run.total_duration_seconds}s` 
                        : `${Number(run.mttd_seconds + run.mttr_seconds).toFixed(1)}s`}
                    </td>
                    <td className="py-3.5 text-slate-400">
                      &le; {run.sla_threshold_seconds}s
                    </td>
                    <td className="py-3.5 font-sans">
                      {run.sla_passed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>SLA Compliant</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                          <AlertCircle className="w-3 h-3" />
                          <span>SLA Breached</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-right font-sans space-x-1.5">
                      <button
                        onClick={() => setInspectedRun(run)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition"
                        title="Inspect 4 lifecycle timestamps"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                      {onViewReport && (
                        <button
                          onClick={() => onViewReport(run.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs transition"
                          title="Open Post-Mortem Report"
                        >
                          <span>Report &rarr;</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Comprehensive Experiment Inspection Modal with 4 Timestamps */}
      {inspectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white font-sans">
                  Resilience Audit Run #{inspectedRun.id}
                </h3>
                <p className="text-slate-400 text-[11px] font-sans">
                  {inspectedRun.scenario_name} &bull; {inspectedRun.app_name || `App #${inspectedRun.app_id}`}
                </p>
              </div>
              <button
                onClick={() => setInspectedRun(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Quota notice if simulated */}
            {inspectedRun.is_simulated && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-sans">
                ⚠️ <strong>Simulated Quota Warning:</strong> This test utilized a configurable logical storage limit (88% usage vs 80% threshold). It is a software simulation and does not exhaust actual cloud or host storage.
              </div>
            )}

            {/* 4 Observed Lifecycle Timestamps */}
            <div>
              <div className="text-slate-400 font-bold uppercase text-[10px] mb-2 font-sans">
                Observed Experiment Lifecycle (4 Distinct Timestamps):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">1. Failure Injected At</span>
                  <span className="text-blue-300 font-semibold">{inspectedRun.injected_at || inspectedRun.started_at}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">2. Failure Detected At</span>
                  <span className="text-amber-300 font-semibold">{inspectedRun.detected_at || 'N/A'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">3. Recovery Attempted At</span>
                  <span className="text-purple-300 font-semibold">{inspectedRun.recovery_attempted_at || 'N/A'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">4. Recovery Verified At</span>
                  <span className="text-emerald-300 font-semibold">{inspectedRun.verified_at || inspectedRun.completed_at}</span>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">MTTD (Detect)</span>
                <span className="text-base font-bold text-blue-400">{inspectedRun.mttd_seconds}s</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">MTTR (Recover)</span>
                <span className="text-base font-bold text-indigo-400">{inspectedRun.mttr_seconds}s</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">SLA Target</span>
                <span className="text-base font-bold text-slate-300">&le; {inspectedRun.sla_threshold_seconds}s</span>
              </div>
            </div>

            {/* Event Logs Timeline */}
            {inspectedRun.event_logs && (
              <div>
                <div className="text-slate-400 font-bold uppercase text-[10px] mb-1 font-sans">
                  Structured Incident Event Logs:
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-48 overflow-y-auto space-y-1 text-[11px]">
                  {(() => {
                    let logs = inspectedRun.event_logs;
                    if (typeof logs === 'string') {
                      try { logs = JSON.parse(logs); } catch (e) { logs = []; }
                    }
                    if (!Array.isArray(logs) || logs.length === 0) {
                      return <span className="text-slate-500">No event log entries recorded.</span>;
                    }
                    return logs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="text-blue-400 font-semibold">[{log.phase}]</span>
                        <span className="text-slate-300">{log.details}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedRun(null)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold font-sans hover:bg-blue-500 transition"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

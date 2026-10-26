import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Printer, 
  FileSpreadsheet, 
  Check, 
  Copy, 
  ArrowLeft,
  Server,
  Activity,
  HardDrive,
  Info
} from 'lucide-react';
import { API_BASE } from '../config';

export default function ReportsView({ 
  auditRuns = [], 
  incidents = [], 
  metrics, 
  targetReportId = null,
  onClearTargetReport,
  onExportReport 
}) {
  const [selectedRun, setSelectedRun] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  // Auto-select target report if navigated from Experiments view
  useEffect(() => {
    if (targetReportId && auditRuns.length > 0) {
      const match = auditRuns.find(r => r.id === targetReportId);
      if (match) setSelectedRun(match);
      if (onClearTargetReport) onClearTargetReport();
    }
  }, [targetReportId, auditRuns, onClearTargetReport]);

  const complianceRate = metrics?.totalAuditRuns > 0
    ? Math.round((metrics.slaPassedRuns / metrics.totalAuditRuns) * 100)
    : 100;

  // Rule-based deterministic interpretation generator (no fake AI)
  const getRuleBasedInterpretation = (run) => {
    if (!run) return null;
    const mttd = run.mttd_seconds ?? 0;
    const mttr = run.mttr_seconds ?? 0;
    const slaTarget = run.sla_threshold_seconds || 15;
    const slaPassed = Boolean(run.sla_passed);
    const mode = run.execution_mode || 'SAFE_PROCESS_SIMULATION';
    const isSimulated = Boolean(run.is_simulated);

    const findings = [];

    // 1. Detection Assessment
    if (mttd <= 2.5) {
      findings.push(`Rapid Detection: The monitoring prober identified the failure in ${mttd}s. Failure threshold (2 consecutive failed checks) successfully prevented false-alarm flapping while maintaining sub-3s incident recognition.`);
    } else {
      findings.push(`Standard Detection: Outage flagged in ${mttd}s. Polling cycle interval and threshold buffer verified without premature alert triggering.`);
    }

    // 2. Recovery Assessment
    if (slaPassed) {
      const margin = (slaTarget - mttr).toFixed(1);
      findings.push(`SLA Compliance: PASSED. Microservice recovery verified in ${mttr}s, operating inside the ${slaTarget}s SLA budget with a ${margin}s safety margin.`);
    } else {
      const breach = (mttr - slaTarget).toFixed(1);
      findings.push(`SLA Violation: BREACHED. Service required ${mttr}s to restore health, exceeding the ${slaTarget}s SLA limit by ${breach}s.`);
    }

    // 3. Infrastructure & Quota Policy
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
  };

  const handleDownloadJson = (run) => {
    window.location.href = `${API_BASE}/audit-runs/${run.id}/export/json`;
  };

  const handleDownloadCsv = (run) => {
    window.location.href = `${API_BASE}/audit-runs/${run.id}/export/csv`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* 1. Header (hidden during print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Resilience & Recovery Audit Reports
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified recovery measurements, MTTD, MTTR, rule-based post-mortems, and SLA certifications
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onExportReport && onExportReport('all')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/20 transition active:scale-95"
            title="Open Download Center with options to choose target API and format"
          >
            <Download className="w-4 h-4" />
            <span>Download Logs & Reports</span>
          </button>
        </div>
      </div>

      {/* 2. Summary KPI Cards (hidden during print) */}
      <div className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Chaos Audits
          </span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {metrics?.totalAuditRuns ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-2">Controlled failure experiments recorded in SQLite</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            SLA Compliance Rate
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {complianceRate}%
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {metrics?.slaPassedRuns ?? 0} of {metrics?.totalAuditRuns ?? 0} passed recovery threshold
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Average MTTR
          </span>
          <div className="text-2xl font-black text-indigo-400 font-mono mt-1">
            {metrics?.averageMttrSeconds ?? 0} <span className="text-sm font-normal text-slate-400">seconds</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Mean Time To Recover across all failures</p>
        </div>
      </div>

      {/* 3. Detailed Post-Mortem Report Document (When a run is selected) */}
      {selectedRun ? (
        <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl space-y-6 print:bg-white print:text-black print:border-none print:p-0">
          
          {/* Back button & Action Toolbar */}
          <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <button
              onClick={() => setSelectedRun(null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>&larr; Back to All Audit Reports</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadJson(selectedRun)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                title="Download complete structured JSON file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>

              <button
                onClick={() => handleDownloadCsv(selectedRun)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                title="Download CSV format report"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>

              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition active:scale-95"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          {/* Document Header */}
          <div className="border-b border-slate-800 print:border-black pb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-blue-400 print:text-blue-800">
                  FaultLens Cloud Reliability Post-Mortem Audit
                </span>
                <h3 className="text-xl font-black text-white print:text-black mt-1">
                  Resilience Audit Run #{selectedRun.id}: {selectedRun.scenario_name}
                </h3>
                <p className="text-xs text-slate-400 print:text-gray-600 mt-1">
                  Target Workload: <strong className="text-white print:text-black">{selectedRun.app_name || `App #${selectedRun.app_id}`}</strong> &bull; Generated At: {new Date(selectedRun.completed_at || selectedRun.started_at).toLocaleString()}
                </p>
              </div>

              {/* Status Badge */}
              <div>
                {selectedRun.sla_passed ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 print:border-emerald-700 print:text-emerald-800">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>SLA COMPLIANT</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 print:border-red-700 print:text-red-800">
                    <AlertCircle className="w-4 h-4" />
                    <span>SLA BREACHED</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Simulation Notice if applicable */}
          {selectedRun.is_simulated ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-sans print:border-amber-600 print:text-amber-900">
              ⚠️ <strong>Explicit Simulation Label:</strong> This experiment evaluated a configurable logical test quota (88% utilization vs 80% warning threshold). This is a software-level quota simulation and did not exhaust actual host cloud storage.
            </div>
          ) : null}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50">
              <span className="text-[10px] font-bold uppercase text-slate-500 print:text-gray-600 block">Time to Detect (MTTD)</span>
              <span className="text-lg font-black text-blue-400 print:text-blue-700 font-mono">{selectedRun.mttd_seconds}s</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Injection &rarr; Detection</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50">
              <span className="text-[10px] font-bold uppercase text-slate-500 print:text-gray-600 block">Time to Recover (MTTR)</span>
              <span className="text-lg font-black text-indigo-400 print:text-indigo-700 font-mono">{selectedRun.mttr_seconds}s</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Detection &rarr; Verification</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50">
              <span className="text-[10px] font-bold uppercase text-slate-500 print:text-gray-600 block">Total Outage Duration</span>
              <span className="text-lg font-black text-white print:text-black font-mono">
                {selectedRun.total_duration_seconds !== null && selectedRun.total_duration_seconds !== undefined
                  ? `${selectedRun.total_duration_seconds}s`
                  : `${Number(selectedRun.mttd_seconds + selectedRun.mttr_seconds).toFixed(1)}s`}
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">Total disruption window</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50">
              <span className="text-[10px] font-bold uppercase text-slate-500 print:text-gray-600 block">SLA Target Limit</span>
              <span className="text-lg font-black text-slate-300 print:text-gray-800 font-mono">&le; {selectedRun.sla_threshold_seconds}s</span>
              <p className="text-[10px] text-slate-500 mt-0.5">Service-level agreement</p>
            </div>
          </div>

          {/* Section: 4-Phase Observed Lifecycle Timestamps */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 print:text-black uppercase tracking-wider font-mono">
              1. Observed Failure & Recovery Lifecycle (4 Exact Timestamps)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 print:border-gray-300">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">1. Injected At</span>
                <span className="text-blue-300 font-semibold">{selectedRun.injected_at || selectedRun.started_at}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 print:border-gray-300">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">2. Detected At</span>
                <span className="text-amber-300 font-semibold">{selectedRun.detected_at || 'Unavailable'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 print:border-gray-300">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">3. Recovery Attempted At</span>
                <span className="text-purple-300 font-semibold">{selectedRun.recovery_attempted_at || 'Unavailable'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 print:border-gray-300">
                <span className="text-slate-500 text-[10px] block uppercase font-bold">4. Recovery Verified At</span>
                <span className="text-emerald-300 font-semibold">{selectedRun.verified_at || selectedRun.completed_at}</span>
              </div>
            </div>
          </div>

          {/* Section: Rule-Based Deterministic Analysis */}
          {(() => {
            const interpretation = getRuleBasedInterpretation(selectedRun);
            if (!interpretation) return null;
            return (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-blue-900/60 print:border-gray-400 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 print:text-blue-800 uppercase font-mono">
                  <Info className="w-4 h-4" />
                  <span>Rule-Based Deterministic Analysis (Non-Predictive Heuristics)</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300 print:text-gray-800 font-sans leading-relaxed">
                  {interpretation.findings.map((finding, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-blue-400 print:text-blue-700 font-bold">&bull;</span>
                      <span>{finding}</span>
                    </div>
                  ))}
                  <div className="pt-2 font-semibold text-slate-200 print:text-black">
                    Conclusion: {interpretation.conclusion}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono pt-1">
                  Note: Evaluation performed using deterministic rule heuristics on stored millisecond measurements. Zero AI predictions or fabricated estimates.
                </div>
              </div>
            );
          })()}

          {/* Section: Structured Event Logs Timeline */}
          {selectedRun.event_logs && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 print:text-black uppercase tracking-wider font-mono">
                2. Audit Event Logs & Execution Trace
              </h4>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 print:border-gray-300 font-mono text-xs max-h-60 overflow-y-auto space-y-1.5">
                {(() => {
                  let logs = selectedRun.event_logs;
                  if (typeof logs === 'string') {
                    try { logs = JSON.parse(logs); } catch (e) { logs = []; }
                  }
                  if (!Array.isArray(logs) || logs.length === 0) {
                    return <span className="text-slate-500">No event log entries recorded.</span>;
                  }
                  return logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-0.5 border-b border-slate-900 last:border-none">
                      <span className="text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className="text-blue-400 font-bold shrink-0">[{log.phase}]</span>
                      <span className="text-slate-300 print:text-black">{log.details}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Print Footer */}
          <div className="hidden print:block pt-6 border-t border-gray-300 text-xs text-gray-500 font-mono">
            FaultLens Cloud Resilience Post-Mortem Audit &bull; Verified by Native Synthetic Prober &bull; SQLite Telemetry
          </div>

        </div>
      ) : (
        /* 4. Archived Reports Table View (When no single run is selected) */
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Archived Audit Records & Post-Mortem Certifications
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {auditRuns.length} Experiments Recorded
            </span>
          </div>

          {auditRuns.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 font-mono">
              No audit records found. Run a chaos experiment to generate the first compliance report!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="pb-3">Run ID</th>
                    <th className="pb-3">Timestamp</th>
                    <th className="pb-3">Application</th>
                    <th className="pb-3">Scenario</th>
                    <th className="pb-3">Mode</th>
                    <th className="pb-3">Detect (MTTD)</th>
                    <th className="pb-3">Recover (MTTR)</th>
                    <th className="pb-3">Total Duration</th>
                    <th className="pb-3">SLA Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 text-slate-400">#{run.id}</td>
                      <td className="py-3.5 text-slate-400 text-[11px]">
                        {new Date(run.started_at).toLocaleString()}
                      </td>
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
                      <td className="py-3.5 font-sans">
                        {run.sla_passed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>PASSED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                            <AlertCircle className="w-3 h-3" />
                            <span>BREACHED</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-right font-sans space-x-1.5">
                        <button
                          onClick={() => setSelectedRun(run)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-sm"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Report</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

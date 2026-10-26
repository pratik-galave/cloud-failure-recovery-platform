import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  CheckCircle2, 
  Copy, 
  Check, 
  Server, 
  Activity, 
  AlertOctagon, 
  FileSpreadsheet, 
  Globe, 
  Terminal, 
  Beaker,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { API_BASE } from '../config';

export default function AuditReportModal({ 
  isOpen, 
  onClose, 
  metrics, 
  applications = [], 
  incidents = [], 
  auditRuns = [],
  initialAppId = 'all'
}) {
  const [selectedAppId, setSelectedAppId] = useState(initialAppId); // 'all' | number
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (initialAppId) {
        setSelectedAppId(initialAppId);
      }
    }
  }, [isOpen, initialAppId]);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const queryParam = selectedAppId !== 'all' ? `?appId=${selectedAppId}` : '';
    fetch(`${API_BASE}/report/export${queryParam}`)
      .then(res => res.text())
      .then(text => {
        setReportMarkdown(text);
        setLoading(false);
      })
      .catch(err => {
        setReportMarkdown(`Error loading report: ${err.message}`);
        setLoading(false);
      });
  }, [isOpen, selectedAppId]);

  if (!isOpen) return null;

  const selectedApp = selectedAppId !== 'all' ? applications.find(a => a.id === Number(selectedAppId)) : null;
  const targetLabel = selectedApp ? `${selectedApp.name} (App #${selectedApp.id})` : 'All Microservices (Consolidated)';

  const triggerDownload = (url, name) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccessToast(`Downloading ${name} for ${targetLabel}...`);
    setTimeout(() => setDownloadSuccessToast(null), 3500);
  };

  const handleDownloadMarkdown = () => {
    const queryParam = selectedAppId !== 'all' ? `?appId=${selectedAppId}` : '';
    triggerDownload(`${API_BASE}/report/export${queryParam}`, 'Resilience Post-Mortem Report (.md)');
  };

  const handleDownloadProbesCsv = () => {
    const queryParam = selectedAppId !== 'all' ? `?appId=${selectedAppId}` : '';
    triggerDownload(`${API_BASE}/probes/export/csv${queryParam}`, 'Telemetry Health Probes CSV');
  };

  const handleDownloadIncidentsCsv = () => {
    const queryParam = selectedAppId !== 'all' ? `?appId=${selectedAppId}` : '';
    triggerDownload(`${API_BASE}/incidents/export/csv${queryParam}`, 'Incident Outages CSV');
  };

  const handleDownloadAuditRunsCsv = () => {
    const queryParam = selectedAppId !== 'all' ? `?appId=${selectedAppId}` : '';
    triggerDownload(`${API_BASE}/audit-runs/export/csv${queryParam}`, 'Chaos Recovery Benchmarks CSV');
  };

  const handleDownloadActivityLogsCsv = () => {
    const queryParam = selectedAppId !== 'all' ? `?appId=${selectedAppId}` : '';
    triggerDownload(`${API_BASE}/activity-logs/export/csv${queryParam}`, 'Activity & Event Logs CSV');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0B101D] border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#111728]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Export Logs & Audit Center
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  Multi-API Filter Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Select which API to export and choose your required logs format (Telemetry, Activity, Incidents, or Post-Mortems)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Main Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* STEP 1: API Workload Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-400 font-mono text-[10px] font-bold border border-blue-500/30">
                  STEP 1
                </span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Which API microservice's logs do you want to download?
                </span>
              </div>

              <span className="text-[11px] font-mono text-slate-400">
                Selected: <span className="text-blue-400 font-bold">{targetLabel}</span>
              </span>
            </div>

            {/* Microservice Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* Option 0: All APIs Consolidated */}
              <button
                type="button"
                onClick={() => setSelectedAppId('all')}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                  selectedAppId === 'all'
                    ? 'bg-blue-950/40 border-blue-500 text-white shadow-lg shadow-blue-950/50 ring-1 ring-blue-500'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Globe className="w-4 h-4" />
                  </div>
                  {selectedAppId === 'all' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400">
                      <Check className="w-3 h-3" /> Selected
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">All Workloads (Consolidated)</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    Combined logs for all {applications.length} microservices
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                  Unified System Dump
                </div>
              </button>

              {/* Options for each registered API */}
              {applications.map((app) => {
                const isSelected = selectedAppId === app.id;
                const status = app.current_status || 'HEALTHY';
                const isHealthy = status === 'HEALTHY';
                const isDegraded = status === 'DEGRADED';

                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedAppId(app.id)}
                    className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 text-white shadow-lg shadow-blue-950/50 ring-1 ring-blue-500'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Server className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                        <span className={`text-[9px] font-mono font-bold uppercase ${
                          isHealthy ? 'text-emerald-400' : isDegraded ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {status}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-blue-400 ml-1" />
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-white truncate">
                        App #{app.id} &bull; {app.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5" title={app.base_url}>
                        {app.base_url}
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                      <span>Threshold: {app.failure_threshold || 2} fails</span>
                      <span>{app.check_interval_seconds || 10}s interval</span>
                    </div>
                  </button>
                );
              })}

            </div>
          </div>

          {/* STEP 2: Choose Logs & Export Formats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/30">
                  STEP 2
                </span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Select the type of logs or reports you want to download
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Filters applied to: <span className="font-semibold text-white">{targetLabel}</span>
              </span>
            </div>

            {/* 5 Download Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              
              {/* 1. Telemetry Health Probes CSV */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Activity className="w-4 h-4" />
                      <span className="text-xs font-bold text-white">Telemetry Latency Probes</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      .CSV
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Granular probe records: timestamps, HTTP status codes, latency in ms, health verdicts, and connection errors.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadProbesCsv}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 font-semibold text-xs transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Telemetry CSV</span>
                </button>
              </div>

              {/* 2. Activity & Event Logs CSV */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Terminal className="w-4 h-4" />
                      <span className="text-xs font-bold text-white">Auditor Activity Logs</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      .CSV
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Complete immutable event stream: state transitions, chaos experiment triggers, recovery alarms, and info events.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadActivityLogsCsv}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 font-semibold text-xs transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Activity Logs CSV</span>
                </button>
              </div>

              {/* 3. Incident Outages CSV */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-400">
                      <AlertOctagon className="w-4 h-4" />
                      <span className="text-xs font-bold text-white">Incident & Outage History</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      .CSV
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Historical downtime incidents: outage start timestamps, detection times, resolution times, and downtime durations.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadIncidentsCsv}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-semibold text-xs transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Incidents CSV</span>
                </button>
              </div>

              {/* 4. Chaos Experiments CSV */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-400">
                      <Beaker className="w-4 h-4" />
                      <span className="text-xs font-bold text-white">Chaos Audit Runs</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      .CSV
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Automated chaos engineering benchmarks: MTTD, MTTR, SLA pass/fail status, and recovery verification timestamps.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadAuditRunsCsv}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 font-semibold text-xs transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Chaos Runs CSV</span>
                </button>
              </div>

              {/* 5. Post-Mortem Report (.MD) */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 to-indigo-950/40 border border-blue-500/30 hover:border-blue-400 transition flex flex-col justify-between space-y-3 md:col-span-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-bold text-white">Executive Post-Mortem & Resilience Audit Report</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      .MD (Markdown)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Complete structured technical documentation ready for GitHub issues, Slack, or engineering post-mortems. Includes architecture analysis, SLA compliance scorecard, incident log, and actionable hardening recommendations.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Resilience Post-Mortem (.md)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 py-2 px-3.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-medium transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Download Notification Toast */}
          {downloadSuccessToast && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-mono animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccessToast}</span>
            </div>
          )}

          {/* STEP 3: Collapsible Markdown Live Preview */}
          <div className="border border-slate-800 rounded-xl bg-[#080D1A] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full px-4 py-2.5 bg-slate-900/90 flex items-center justify-between text-xs text-slate-300 hover:text-white transition"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold">Live Report Preview: {targetLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-[10px] font-mono">
                  {showPreview ? 'Click to collapse preview' : 'Click to expand preview'}
                </span>
                {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showPreview && (
              <div className="p-5 max-h-72 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed bg-[#050811] border-t border-slate-800/80">
                {loading ? (
                  <div className="h-32 flex items-center justify-center text-slate-500">
                    Generating live preview for {targetLabel}...
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap selection:bg-blue-600 selection:text-white">
                    {reportMarkdown}
                  </pre>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#111728] flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[11px]">
            Targeting: <strong className="text-white">{targetLabel}</strong> &bull; Pure Local Node.js + SQLite Engine
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Clock, FileText, Check, AlertCircle } from 'lucide-react';

export default function IncidentHistory({ incidents = [], auditRuns = [] }) {
  const [activeTab, setActiveTab] = useState('audits'); // 'audits' | 'incidents'

  return (
    <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
      
      {/* Header and Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Auditing & Incident Logs
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable SQLite records of failure telemetry, MTTD, MTTR, and SLA compliance
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
          <button
            onClick={() => setActiveTab('audits')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'audits'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Chaos Audit Runs ({auditRuns.length})
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'incidents'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Incident Timeline ({incidents.length})
          </button>
        </div>
      </div>

      {/* 1. Chaos Audit Runs Table */}
      {activeTab === 'audits' && (
        <div className="overflow-x-auto">
          {auditRuns.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500 font-mono">
              No chaos audits executed yet. Click a scenario card above to run your first resilience audit!
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="pb-3 font-semibold">Run ID</th>
                  <th className="pb-3 font-semibold">Scenario Executed</th>
                  <th className="pb-3 font-semibold">MTTD (Detect)</th>
                  <th className="pb-3 font-semibold">MTTR (Recover)</th>
                  <th className="pb-3 font-semibold">SLA Target</th>
                  <th className="pb-3 font-semibold">SLA Verdict</th>
                  <th className="pb-3 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 text-slate-400">#{run.id}</td>
                    <td className="py-3 font-sans font-semibold text-white">
                      {run.scenario_name}
                    </td>
                    <td className="py-3 text-blue-400 font-bold">
                      {run.mttd_seconds}s
                    </td>
                    <td className="py-3 text-indigo-400 font-bold">
                      {run.mttr_seconds}s
                    </td>
                    <td className="py-3 text-slate-400">
                      &le; {run.sla_threshold_seconds}s
                    </td>
                    <td className="py-3 font-sans">
                      {run.sla_passed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-3 h-3" />
                          <span>SLA Compliant</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                          <AlertCircle className="w-3 h-3" />
                          <span>SLA Breached</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-slate-400 text-right text-[11px]">
                      {new Date(run.started_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 2. Incidents Timeline Table */}
      {activeTab === 'incidents' && (
        <div className="overflow-x-auto">
          {incidents.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500 font-mono">
              No cloud incidents recorded in database. System is completely healthy!
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="pb-3 font-semibold">ID</th>
                  <th className="pb-3 font-semibold">Incident Type</th>
                  <th className="pb-3 font-semibold">Root Cause Trigger</th>
                  <th className="pb-3 font-semibold">Downtime (MTTR)</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Started At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 text-slate-400">#{inc.id}</td>
                    <td className="py-3 font-bold text-white">
                      {inc.incident_type}
                    </td>
                    <td className="py-3 font-sans text-slate-300 max-w-xs truncate">
                      {inc.trigger_cause || 'Health probe failed'}
                    </td>
                    <td className="py-3 text-indigo-400 font-bold">
                      {inc.duration_seconds ? `${inc.duration_seconds}s` : 'Active / Ongoing'}
                    </td>
                    <td className="py-3 font-sans">
                      {inc.status === 'RESOLVED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          RESOLVED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                          OPEN
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-slate-400 text-right text-[11px]">
                      {new Date(inc.started_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}

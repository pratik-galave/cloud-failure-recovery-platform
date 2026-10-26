import React from 'react';
import HealthHUD from './HealthHUD';
import LatencyChart from './LatencyChart';
import ChaosPanel from './ChaosPanel';
import { 
  Server, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  AlertOctagon,
  Activity,
  ShieldCheck
} from 'lucide-react';

export default function OverviewView({ 
  status, 
  metrics, 
  probes, 
  applications = [], 
  incidents = [],
  activityLogs = [], 
  onTriggerChaos, 
  onSelectApp, 
  onNavigateTab 
}) {
  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* 1. Global KPIs & Target State */}
      <HealthHUD
        status={status}
        metrics={metrics}
        lastProbe={status?.lastProbe || status?.applications?.[0]?.lastProbe || applications?.[0]?.lastProbe}
      />

      {/* 2. Telemetry Sparkline Chart */}
      <LatencyChart
        probes={probes}
        applications={applications}
        onSelectApp={onSelectApp}
      />

      {/* 3. Two Columns: Registered Applications Summary & Chaos Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Quick Chaos Control Room */}
        <div className="lg:col-span-2">
          <ChaosPanel
            applications={applications}
            onTriggerChaos={onTriggerChaos}
            activeExperiment={status?.activeExperiment}
          />
        </div>

        {/* Right 1 Col: Registered Microservices & Quick Link */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Target Workloads
                </h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                {applications.length} Active
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Monitored microservices sending real-time health telemetry to FaultLens:
            </p>

            <div className="space-y-3">
              {applications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-mono">
                  No workloads registered.
                </div>
              ) : (
                applications.slice(0, 3).map((app) => {
                  const isHealthy = app.status === 'HEALTHY';
                  const isDegraded = app.status === 'DEGRADED';
                  return (
                    <div
                      key={app.id}
                      onClick={() => onSelectApp(app.id)}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-blue-500/40 cursor-pointer transition flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white group-hover:text-blue-400 transition">
                            {app.name}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${
                            isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-red-400'
                          }`} />
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {app.base_url}
                        </div>
                      </div>

                      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('applications')}
            className="w-full mt-4 py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <span>Manage All Applications</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* 4. Recent Incidents & Outage Telemetry Table */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Recent Incidents & Outage Telemetry
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total Incidents: {incidents.length}
          </span>
        </div>

        {incidents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-950/50 rounded-xl border border-slate-800/60 flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400/60" />
            <span>No incidents recorded. All microservices are operating nominally.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="pb-3 font-semibold">Incident</th>
                  <th className="pb-3 font-semibold">Target Microservice</th>
                  <th className="pb-3 font-semibold">Classification</th>
                  <th className="pb-3 font-semibold">Trigger Cause</th>
                  <th className="pb-3 font-semibold">Duration</th>
                  <th className="pb-3 font-semibold">Status & Outcome</th>
                  <th className="pb-3 font-semibold text-right">Detected At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {incidents.slice(0, 6).map((inc) => {
                  const isResolved = inc.status === 'RESOLVED';
                  return (
                    <tr key={inc.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 text-slate-400">#{inc.id}</td>
                      <td className="py-3 font-sans font-semibold text-white">
                        {inc.app_name || `App #${inc.app_id}`}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                          {inc.incident_type}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300 max-w-xs truncate" title={inc.trigger_cause}>
                        {inc.trigger_cause}
                      </td>
                      <td className="py-3 text-indigo-400 font-bold">
                        {inc.duration_seconds !== null ? `${inc.duration_seconds}s` : 'Active'}
                      </td>
                      <td className="py-3 font-sans">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Resolved</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Outage Active</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-400 text-right text-[11px]">
                        {new Date(inc.started_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Recent Activity Preview */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Recent Auditor Activity Stream
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('activity')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
          >
            View Full Log &rarr;
          </button>
        </div>

        {activityLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 font-mono">
            No activity logs recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {activityLogs.slice(0, 4).map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-4 text-xs font-mono">
                <div className="flex items-start gap-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                    log.severity === 'ERROR'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : log.severity === 'WARN'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : log.severity === 'SUCCESS'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {log.event_type}
                  </span>
                  <span className="text-slate-300 font-sans">{log.message}</span>
                </div>
                <span className="text-slate-500 text-[11px] shrink-0">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

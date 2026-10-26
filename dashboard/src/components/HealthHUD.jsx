import React from 'react';
import { Server, Activity, CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, Zap } from 'lucide-react';

export default function HealthHUD({ status, metrics, lastProbe }) {
  const resolvedProbe = lastProbe || status?.lastProbe || status?.applications?.[0]?.lastProbe || null;
  const targetStatus =
    status?.targetStatus ||
    status?.applications?.[0]?.current_status ||
    (metrics?.downApplications > 0 ? 'DOWN' : (metrics?.degradedApplications > 0 ? 'DEGRADED' : (metrics?.allHealthy ? 'HEALTHY' : 'UNKNOWN')));
  const isHealthy = targetStatus === 'HEALTHY';
  const isDegraded = targetStatus === 'DEGRADED';
  const isDown = targetStatus === 'DOWN';
  const latency = resolvedProbe?.latencyMs ?? resolvedProbe?.latency_ms;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* 1. Main Service Status Card */}
      <div className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
        isHealthy
          ? 'bg-slate-900/70 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
          : isDegraded
          ? 'bg-slate-900/70 border-amber-500/30 shadow-lg shadow-amber-500/5'
          : 'bg-slate-900/70 border-red-500/40 shadow-lg shadow-red-500/10'
      }`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Monitored Target State
            </span>
            <div className="flex items-center gap-2.5 mt-1">
              <span className={`relative flex h-3.5 w-3.5`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-red-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                  isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-red-500'
                }`}></span>
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white font-mono">
                {targetStatus}
              </h2>
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border ${
            isHealthy
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : isDegraded
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-red-500/10 border-red-500/40 text-red-400'
          }`}>
            {isHealthy ? <CheckCircle2 className="w-5 h-5" /> : isDegraded ? <AlertTriangle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-slate-300">
            {typeof latency === 'number' ? `${latency}ms latency` : 'Probing...'}
          </span>
          <span className="text-[11px] text-slate-400">
            HTTP {resolvedProbe?.statusCode || '---'}
          </span>
        </div>
      </div>

      {/* 2. Service Availability KPI */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Availability (Uptime)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <h2 className="text-2xl font-black tracking-tight text-white font-mono">
                {metrics?.availabilityPercentage ?? 100}%
              </h2>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Probes recorded</span>
          <span className="font-mono text-blue-400 font-semibold">{metrics?.totalProbes ?? 0}</span>
        </div>
      </div>

      {/* 3. Mean Time To Recover (MTTR) */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Average MTTR
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <h2 className="text-2xl font-black tracking-tight text-white font-mono">
                {metrics?.averageMttrSeconds ?? 0}
                <span className="text-sm font-normal text-slate-400 ml-1">sec</span>
              </h2>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Resolved incidents</span>
          <span className="font-mono text-indigo-400 font-semibold">{metrics?.resolvedIncidents ?? 0} of {metrics?.totalIncidents ?? 0}</span>
        </div>
      </div>

      {/* 4. Chaos Resilience & SLA Pass Rate */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Resilience SLA Pass
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <h2 className="text-2xl font-black tracking-tight text-white font-mono">
                {metrics?.totalAuditRuns > 0
                  ? `${Math.round((metrics.slaPassedRuns / metrics.totalAuditRuns) * 100)}%`
                  : '100%'}
              </h2>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Audited experiments</span>
          <span className="font-mono text-cyan-400 font-semibold">{metrics?.slaPassedRuns ?? 0}/{metrics?.totalAuditRuns ?? 0}</span>
        </div>
      </div>

    </div>
  );
}

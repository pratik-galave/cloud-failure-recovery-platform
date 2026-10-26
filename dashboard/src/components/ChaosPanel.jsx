import React, { useState } from 'react';
import { Flame, Clock, AlertTriangle, ShieldCheck, Play, RotateCcw, Loader2, HardDrive, ShieldAlert, Server } from 'lucide-react';

const SCENARIOS = [
  {
    key: 'DOCKER_SERVICE_UNAVAILABLE',
    name: 'Scenario 1: Service Outage',
    category: 'INFRASTRUCTURE OUTAGE',
    faultLocal: 'docker stop faultlens-target-service',
    faultExternal: 'Synthetic network partition / dropped connection',
    sla: '18.0s SLA Limit',
    desc: 'Stops or isolates the target microservice. Audits outage detection and records incident in SQLite.',
    color: 'from-rose-500/20 to-red-950/40 border-rose-500/40 text-rose-400',
    isDestructive: true
  },
  {
    key: 'AUTO_RECOVERY_TEST',
    name: 'Scenario 2: Auto Recovery',
    category: 'SELF-HEALING',
    faultLocal: 'Crash injection -> docker restart container',
    faultExternal: 'Synthetic fault injection -> prober auto-recovery',
    sla: '15.0s SLA Limit',
    desc: 'Injects failure, detects outage, triggers remediation, and audits recovery MTTR.',
    color: 'from-blue-500/20 to-indigo-950/40 border-blue-500/40 text-blue-400',
    isDestructive: false
  },
  {
    key: 'STORAGE_QUOTA_SIMULATION',
    name: 'Scenario 3: Quota Warning',
    category: 'STORAGE SIMULATION',
    faultLocal: 'Logical Quota: 88% usage vs 80% rule',
    faultExternal: 'Simulated high-latency & degradation threshold',
    sla: '12.0s SLA Limit',
    desc: 'Simulates degraded performance warning to audit degraded state handling.',
    color: 'from-amber-500/20 to-orange-950/40 border-amber-500/40 text-amber-400',
    isDestructive: false
  }
];

export default function ChaosPanel({ onTriggerChaos, activeExperiment, onEmergencyRecover, applications = [] }) {
  const [selectedAppId, setSelectedAppId] = useState(applications.length > 0 ? applications[0].id : 1);
  const [runningKey, setRunningKey] = useState(null);

  const selectedApp = applications.find(a => a.id === selectedAppId) || applications[0] || null;
  const isDefaultLocalTarget = selectedAppId === 1;

  const handleRun = async (scenarioKey) => {
    setRunningKey(scenarioKey);
    try {
      await onTriggerChaos(scenarioKey, selectedAppId);
    } finally {
      setRunningKey(null);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-5">
      
      {/* Header: Title + Target Microservice Dropdown */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Chaos Engineering & Recovery Auditor
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Inject controlled cloud failure scenarios and audit automated recovery against resilience SLAs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Target Microservice Selector */}
          {applications && applications.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Server className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Target Workload:</span>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(Number(e.target.value))}
                  disabled={Boolean(activeExperiment || runningKey)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer mt-0.5"
                >
                  {applications.map((app) => (
                    <option key={app.id} value={app.id} className="bg-slate-900 text-white">
                      App #{app.id} - {app.name} ({app.current_status || 'HEALTHY'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeExperiment && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Auditing: {activeExperiment.scenarioName} on App #{activeExperiment.appId}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3 Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SCENARIOS.map((sc) => {
          const isThisRunning = runningKey === sc.key || (activeExperiment && activeExperiment.scenarioId === sc.key);
          const isAnyRunning = Boolean(activeExperiment || runningKey);

          return (
            <div
              key={sc.key}
              className={`p-4 rounded-xl border bg-gradient-to-br flex flex-col justify-between transition-all ${sc.color} ${
                isThisRunning ? 'ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-bold text-white text-sm">
                    {sc.name}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/70 border border-slate-800 text-slate-300">
                    {sc.sla}
                  </span>
                </div>

                <p className="text-xs text-slate-300/80 mb-3 leading-relaxed">
                  {sc.desc}
                </p>

                <div className="text-[11px] font-mono text-slate-300 mb-4 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                  <span className="text-slate-500">Fault Mechanism:</span>{' '}
                  <span className="text-slate-200">
                    {isDefaultLocalTarget ? sc.faultLocal : sc.faultExternal}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleRun(sc.key)}
                disabled={isAnyRunning}
                className={`w-full py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${
                  isThisRunning
                    ? 'bg-blue-600 text-white cursor-wait'
                    : isAnyRunning
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : sc.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-950'
                }`}
              >
                {isThisRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Auditing Recovery...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch on {selectedApp?.name ? selectedApp.name.split(' ')[0] : 'Workload'}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}

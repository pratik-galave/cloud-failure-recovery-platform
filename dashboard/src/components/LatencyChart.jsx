import React, { useState, useMemo } from 'react';
import { Activity, Clock, Layers, LayoutGrid, Server, ArrowRight } from 'lucide-react';

export default function LatencyChart({ probes = [], applications = [], onSelectApp }) {
  const [selectedAppId, setSelectedAppId] = useState('split'); // 'split' | 'combined' | number (app.id)
  const [hoveredProbe, setHoveredProbe] = useState(null);

  // Map of apps by id for quick lookup
  const appMap = useMemo(() => {
    const map = {};
    applications.forEach(a => {
      map[a.id] = a;
    });
    return map;
  }, [applications]);

  const hasMultipleApps = applications && applications.length > 1;

  // Filter probes for a specific app
  const getProbesForApp = (appId) => {
    return probes.filter(p => (p.app_id || 1) === appId).slice(-35);
  };

  // Helper to render a clean sparkline for a set of probes
  const renderSparkline = (appProbes, heightClass = 'h-24', isCompact = false) => {
    if (!appProbes || appProbes.length === 0) {
      return (
        <div className={`${heightClass} flex items-center justify-center text-xs text-slate-500 font-mono`}>
          Awaiting telemetry probes for this microservice...
        </div>
      );
    }

    const maxLatency = Math.max(
      100,
      ...appProbes.map(p => p.latency_ms || 0)
    );

    return (
      <div className={`${heightClass} flex items-end gap-1 pt-3 pb-1 border-b border-slate-800/80`}>
        {appProbes.map((probe, idx) => {
          const latency = probe.latency_ms || 0;
          const heightPct = !probe.is_healthy
            ? 100
            : Math.max(12, Math.min(100, (latency / maxLatency) * 100));

          const isFailed = !probe.is_healthy;
          const isDegraded = probe.is_healthy && latency > 1000;

          const barColor = isFailed
            ? 'bg-red-500 shadow-sm shadow-red-500/50'
            : isDegraded
            ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
            : 'bg-emerald-500 hover:bg-emerald-400';

          return (
            <div
              key={probe.id || idx}
              onMouseEnter={() => setHoveredProbe(probe)}
              onMouseLeave={() => setHoveredProbe(null)}
              className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
            >
              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full rounded-t-xs transition-all duration-200 ${barColor}`}
              />
            </div>
          );
        })}
      </div>
    );
  };

  // 1. Single Application or Filtered Specific App View
  const targetAppId = typeof selectedAppId === 'number' ? selectedAppId : (applications[0]?.id || 1);
  const activeApp = appMap[targetAppId] || applications[0] || null;
  const filteredProbes = typeof selectedAppId === 'number' 
    ? getProbesForApp(targetAppId)
    : probes.slice(-35);

  const activeDisplayProbes = selectedAppId === 'combined' || !hasMultipleApps 
    ? probes.slice(-35) 
    : getProbesForApp(targetAppId);

  return (
    <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
      
      {/* Header: Title, Application Count, and View Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Live Probe Telemetry (Round-Trip Latency)
            </h3>
            {hasMultipleApps && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {applications.length} Microservices Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time synthetic HTTP health probe response times sampled periodically
          </p>
        </div>

        {/* Multi-App Filter Switcher (Only visible when >1 app registered) */}
        {hasMultipleApps && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedAppId('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                selectedAppId === 'split'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Split Graphs (3 Independent)</span>
            </button>

            {applications.map(app => (
              <button
                key={app.id}
                onClick={() => setSelectedAppId(app.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-mono text-[11px] transition ${
                  selectedAppId === app.id
                    ? 'bg-slate-800 text-blue-400 font-bold border border-blue-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  app.current_status === 'HEALTHY' ? 'bg-emerald-400' : 'bg-amber-400'
                }`} />
                <span>{app.name}</span>
              </button>
            ))}

            <button
              onClick={() => setSelectedAppId('combined')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition ${
                selectedAppId === 'combined'
                  ? 'bg-slate-800 text-slate-200 font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Combined Feed</span>
            </button>
          </div>
        )}
      </div>

      {/* VIEW MODE 1: Split Graphs (Each Application Gets Its Own Clean Sparkline) */}
      {hasMultipleApps && selectedAppId === 'split' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {applications.map(app => {
            const appProbes = getProbesForApp(app.id);
            const latestProbe = appProbes.length > 0 ? appProbes[appProbes.length - 1] : null;
            const isHealthy = app.current_status === 'HEALTHY';
            const isDegraded = app.current_status === 'DEGRADED';
            const latency = typeof latestProbe?.latency_ms === 'number' ? latestProbe.latency_ms : null;

            return (
              <div
                key={app.id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  {/* Microservice Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`relative flex h-2 w-2`}>
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-red-400'
                          }`} />
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${
                            isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-red-500'
                          }`} />
                        </span>
                        <h4 className="font-bold text-slate-200 text-xs truncate" title={app.name}>
                          {app.name}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5" title={app.base_url}>
                        {app.base_url}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`font-mono text-xs font-bold ${
                        latency !== null 
                          ? (latency > 1000 ? 'text-amber-400' : 'text-emerald-400')
                          : 'text-red-400'
                      }`}>
                        {latency !== null ? `${latency}ms` : 'Down'}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {latestProbe?.status_code ? `HTTP ${latestProbe.status_code}` : '---'}
                      </div>
                    </div>
                  </div>

                  {/* Dedicated Clean Sparkline for this specific app */}
                  {renderSparkline(appProbes, 'h-20', true)}
                </div>

                {/* Footer link to drill down */}
                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-800/50 text-[11px] text-slate-400">
                  <span className="font-mono text-slate-500">Interval: {app.check_interval_seconds || 10}s</span>
                  {onSelectApp && (
                    <button
                      onClick={() => onSelectApp(app.id)}
                      className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 group"
                    >
                      <span>Drill down</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: Single Focus Chart or Combined Stream */}
      {(!hasMultipleApps || selectedAppId !== 'split') && (
        <div className="space-y-3">
          
          {/* Subheader info: Hover details or latest status */}
          <div className="flex items-center justify-between text-xs font-mono bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">
                {selectedAppId === 'combined' ? 'Combined Workloads Feed:' : `Workload: ${activeApp?.name || 'Selected'}`}
              </span>
              {selectedAppId !== 'combined' && activeApp && (
                <span className="text-slate-500 text-[11px]">({activeApp.base_url})</span>
              )}
            </div>

            <div>
              {hoveredProbe ? (
                <div className="flex items-center gap-3">
                  {hoveredProbe.app_id && appMap[hoveredProbe.app_id] && (
                    <span className="text-blue-400 font-bold">
                      [{appMap[hoveredProbe.app_id].name}]
                    </span>
                  )}
                  <span className="text-slate-400">
                    {new Date(hoveredProbe.timestamp).toLocaleTimeString()}:
                  </span>
                  <span className={hoveredProbe.is_healthy ? (hoveredProbe.latency_ms > 1000 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold') : 'text-red-400 font-bold'}>
                    {hoveredProbe.is_healthy 
                      ? (typeof hoveredProbe.latency_ms === 'number' ? `${hoveredProbe.latency_ms}ms` : 'Unavailable')
                      : 'Unavailable (Outage)'}
                  </span>
                  <span className="text-slate-500">
                    {hoveredProbe.status_code ? `HTTP ${hoveredProbe.status_code}` : 'Connection Refused'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Latest Observation:</span>
                  <span className={
                    activeDisplayProbes.length > 0 && typeof activeDisplayProbes[activeDisplayProbes.length - 1]?.latency_ms === 'number'
                      ? (activeDisplayProbes[activeDisplayProbes.length - 1].latency_ms > 1000 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold')
                      : 'text-amber-400 font-bold'
                  }>
                    {activeDisplayProbes.length > 0 && typeof activeDisplayProbes[activeDisplayProbes.length - 1]?.latency_ms === 'number'
                      ? `${activeDisplayProbes[activeDisplayProbes.length - 1].latency_ms}ms`
                      : 'Unavailable'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Large Primary Chart */}
          {renderSparkline(activeDisplayProbes, 'h-32', false)}
        </div>
      )}

      {/* Chart Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 pt-2 font-mono gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
            <span>Optimal (&lt;1000ms)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
            <span>Degraded (&gt;1000ms)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-red-500" />
            <span>Outage (500 / Down)</span>
          </div>
        </div>

        <div className="text-slate-500">
          Hover over any bar to inspect microservice name, timestamp, and latency
        </div>
      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Server, 
  Activity, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  ExternalLink, 
  Play, 
  RotateCcw,
  Settings,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  Download
} from 'lucide-react';
import LatencyChart from './LatencyChart';
import { API_BASE } from '../config';

export default function ApplicationDetailView({ appId, onBack, onTriggerChaos, onExportReport }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningKey, setRunningKey] = useState(null);

  // Edit config state
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [healthEndpoint, setHealthEndpoint] = useState('/health');
  const [checkIntervalSeconds, setCheckIntervalSeconds] = useState(10);
  const [failureThreshold, setFailureThreshold] = useState(2);
  const [timeoutMs, setTimeoutMs] = useState(4000);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState(null);

  const fetchDetails = async () => {
    try {
      const res = await fetch(`${API_BASE}/applications/${appId}`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
        if (!isEditingConfig) {
          setHealthEndpoint(data.application.health_endpoint || '/health');
          setCheckIntervalSeconds(data.application.check_interval_seconds || 10);
          setFailureThreshold(data.application.failure_threshold || 2);
          setTimeoutMs(data.application.timeout_ms || 4000);
        }
      }
    } catch (err) {
      console.error('[AppDetail Fetch Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    const timer = setInterval(fetchDetails, 1500);
    return () => clearInterval(timer);
  }, [appId]);

  if (loading && !details) {
    return (
      <div className="p-12 text-center text-xs font-mono text-slate-500 animate-pulse">
        Loading telemetry for Application #{appId}...
      </div>
    );
  }

  if (!details || !details.application) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-red-400 font-bold text-sm">Application #{appId} not found or was removed.</p>
        <button onClick={onBack} className="text-xs text-blue-400 underline">Back to Applications</button>
      </div>
    );
  }

  const { application: app, status, lastProbe, recentProbes, recentIncidents, lastSuccessfulCheck } = details;
  const isHealthy = status === 'HEALTHY';
  const isDegraded = status === 'DEGRADED';
  const isDown = status === 'UNAVAILABLE' || status === 'DOWN';

  const handleExperiment = async (scenarioKey) => {
    setRunningKey(scenarioKey);
    try {
      await onTriggerChaos(scenarioKey, app.id);
      await fetchDetails();
    } finally {
      setRunningKey(null);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/applications/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          healthEndpoint: healthEndpoint.trim(),
          checkIntervalSeconds: parseInt(checkIntervalSeconds, 10),
          failureThreshold: parseInt(failureThreshold, 10),
          timeoutMs: parseInt(timeoutMs, 10)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update config');

      setConfigSuccessMsg('Monitoring configuration updated successfully!');
      setTimeout(() => setConfigSuccessMsg(null), 3000);
      setIsEditingConfig(false);
      await fetchDetails();
    } catch (err) {
      alert(`Error updating configuration: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Bar with Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Applications</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onExportReport && onExportReport(app.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold transition active:scale-95 shadow-sm"
            title={`Export logs, telemetry, and post-mortem report for ${app.name}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Logs for {app.name}</span>
          </button>

          <span className="text-xs font-mono text-slate-500">
            Application ID: #{app.id}
          </span>
        </div>
      </div>

      {configSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4" />
          <span>{configSuccessMsg}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Server className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {app.name}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase ${
                isHealthy
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : isDegraded
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {status}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              {app.description || 'Target microservice under continuous resilience audit.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono text-slate-400">
              <a 
                href={app.base_url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>{app.base_url}</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
              <span>&bull;</span>
              <span>Probe: {app.health_endpoint}</span>
              <span>&bull;</span>
              <span>Interval: {app.check_interval_seconds}s</span>
              <span>&bull;</span>
              <span>Threshold: {app.failure_threshold} fails</span>
              <span>&bull;</span>
              <span>
                Last Latency:{' '}
                {typeof lastProbe?.latencyMs === 'number' ? (
                  <strong className={lastProbe.isHealthy ? 'text-emerald-400' : 'text-amber-400'}>
                    {lastProbe.latencyMs}ms
                  </strong>
                ) : (
                  <strong className="text-red-400">UNAVAILABLE (N/A)</strong>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions & Settings Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditingConfig(!isEditingConfig)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{isEditingConfig ? 'Close Settings' : 'Configure Probing'}</span>
          </button>
        </div>
      </div>

      {/* Inline Configuration Editor */}
      {isEditingConfig && (
        <form onSubmit={handleSaveConfig} className="p-6 rounded-2xl bg-slate-900 border border-blue-500/30 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Adjust Health Probing Settings
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Updates applied immediately to master scheduler</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Health Endpoint</label>
              <input
                type="text"
                value={healthEndpoint}
                onChange={(e) => setHealthEndpoint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Check Interval (Sec)</label>
              <input
                type="number"
                min="2"
                max="300"
                value={checkIntervalSeconds}
                onChange={(e) => setCheckIntervalSeconds(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Failure Threshold (Fails)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={failureThreshold}
                onChange={(e) => setFailureThreshold(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">HTTP Timeout (ms)</label>
              <input
                type="number"
                min="1000"
                max="15000"
                step="500"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditingConfig(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingConfig}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingConfig ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Status Coordinates & Last Successful Check Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 font-mono text-xs">
          <span className="text-slate-500">Current Health State</span>
          <div className="text-base font-bold text-white mt-1 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-red-400'
            }`} />
            <span>{status}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 font-mono text-xs">
          <span className="text-slate-500">Last Successful Check</span>
          <div className="text-base font-bold text-emerald-400 mt-1">
            {lastSuccessfulCheck ? new Date(lastSuccessfulCheck).toLocaleTimeString() : 'N/A'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 font-mono text-xs">
          <span className="text-slate-500">Consecutive Fails</span>
          <div className="text-base font-bold text-white mt-1">
            {details.consecutiveFailures || 0} / {app.failure_threshold || 2} fails
          </div>
        </div>
      </div>

      {/* Latency Chart for this App */}
      <LatencyChart
        probes={recentProbes}
      />

      {/* Recent Incidents for this App */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
          Incident Audit History for {app.name}
        </h3>

        {recentIncidents && recentIncidents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="pb-3">ID</th>
                  <th className="pb-3">Incident Type</th>
                  <th className="pb-3">Cause</th>
                  <th className="pb-3">Downtime (MTTR)</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/20">
                    <td className="py-2.5 text-slate-400">#{inc.id}</td>
                    <td className="py-2.5 font-bold text-white">{inc.incident_type}</td>
                    <td className="py-2.5 font-sans text-slate-300">{inc.trigger_cause}</td>
                    <td className="py-2.5 text-indigo-400 font-bold">{inc.duration_seconds ? `${inc.duration_seconds}s` : 'Active'}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inc.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'
                      }`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-400 text-[11px]">
                      {new Date(inc.started_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 font-mono py-4 text-center">
            No incidents recorded for this microservice. It is running smoothly!
          </p>
        )}
      </div>

    </div>
  );
}

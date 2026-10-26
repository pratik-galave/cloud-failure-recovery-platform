import React, { useState } from 'react';
import { Server, Plus, ArrowRight, Trash2, CheckCircle2, AlertTriangle, XCircle, Clock, ExternalLink, ShieldCheck } from 'lucide-react';
import { API_BASE } from '../config';

export default function ApplicationsView({ 
  applications = [], 
  onSelectApp, 
  onOpenRegisterModal, 
  onAppDeleted 
}) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (app) => {
    if (app.id === 1) {
      alert('The core default target microservice (ID: 1) cannot be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to deregister application "${app.name}"?`)) {
      return;
    }

    setDeletingId(app.id);
    try {
      const res = await fetch(`${API_BASE}/applications/${app.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove application');
      }
      onAppDeleted(app.id);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header and Registration Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Registered Test Applications
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Target microservices with configurable health endpoints, polling intervals, and consecutive-failure thresholds
          </p>
        </div>

        <button
          onClick={onOpenRegisterModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs shadow-lg shadow-blue-600/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Application</span>
        </button>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {applications.map((app) => {
          const isHealthy = app.status === 'HEALTHY';
          const isDegraded = app.status === 'DEGRADED';
          const isDown = app.status === 'UNAVAILABLE' || app.status === 'DOWN';
          const lastProbe = app.lastProbe;

          return (
            <div
              key={app.id}
              className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-between"
            >
              <div>
                {/* Title & Status Badge */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        APP #{app.id}
                      </span>
                      {app.id === 1 && (
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          CORE TARGET
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {app.name}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono ${
                    isHealthy
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : isDegraded
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}>
                    {isHealthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : isDegraded ? <AlertTriangle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>{app.status || 'UNKNOWN'}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                  {app.description || 'No description provided.'}
                </p>

                {/* Technical Coordinates & Monitoring Settings */}
                <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800/60 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Base URL:</span>
                    <a 
                      href={app.base_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <span>{app.base_url}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Probe Endpoint:</span>
                    <span className="text-slate-300">{app.health_endpoint || '/health'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Check Interval:</span>
                    <span className="text-blue-400 font-bold">{app.check_interval_seconds || 10}s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Failure Threshold:</span>
                    <span className="text-slate-300">{app.failure_threshold || 2} fails</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Last Latency:</span>
                    {typeof lastProbe?.latencyMs === 'number' ? (
                      <span className={lastProbe.isHealthy ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {lastProbe.latencyMs}ms
                      </span>
                    ) : (
                      <span className="text-red-400 font-bold">
                        {isDown ? 'UNAVAILABLE (N/A)' : '--'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/50 text-[11px]">
                    <span className="text-slate-500">Last Healthy Check:</span>
                    <span className="text-slate-400">
                      {app.last_successful_check ? new Date(app.last_successful_check).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Added {new Date(app.created_at).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2">
                  {app.id !== 1 && (
                    <button
                      onClick={() => handleDelete(app)}
                      disabled={deletingId === app.id}
                      title="Deregister Application"
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => onSelectApp(app.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
                  >
                    <span>View Telemetry</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}

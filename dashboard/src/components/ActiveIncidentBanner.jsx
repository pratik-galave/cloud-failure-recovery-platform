import React, { useState, useEffect } from 'react';
import { AlertOctagon, RotateCcw, Clock, ShieldAlert } from 'lucide-react';

export default function ActiveIncidentBanner({ incident, targetStatus, onEmergencyRecover }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!incident || !incident.started_at) {
      setElapsedSeconds(0);
      return;
    }

    const start = new Date(incident.started_at).getTime();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(((now - start) / 1000).toFixed(1));
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 500);
    return () => clearInterval(timer);
  }, [incident]);

  if (!incident && targetStatus !== 'DOWN') {
    return null;
  }

  const handleRecover = async () => {
    setRecovering(true);
    await onEmergencyRecover();
    setRecovering(false);
  };

  return (
    <div className="bg-gradient-to-r from-red-950/90 via-red-900/60 to-slate-900/90 border-b border-red-500/40 px-6 py-3.5 text-white animate-fadeIn">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        <div className="flex items-center gap-3.5">
          <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-red-300 text-sm tracking-wide">
                ACTIVE CLOUD INCIDENT DETECTED
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-red-500/30 text-red-200 border border-red-500/50">
                {incident?.incident_type || 'SERVICE_OUTAGE'}
              </span>
            </div>
            <p className="text-xs text-red-200/80 mt-0.5">
              {incident?.trigger_cause || 'Target microservice is failing health probes (HTTP 500 / Unreachable)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-xs text-red-200 bg-red-950/60 px-3 py-1.5 rounded-lg border border-red-500/30">
            <Clock className="w-3.5 h-3.5 text-red-400" />
            <span>Outage Duration:</span>
            <span className="font-bold text-white text-sm">{elapsedSeconds}s</span>
          </div>

          <button
            onClick={handleRecover}
            disabled={recovering}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white font-medium text-xs shadow-lg shadow-red-600/30 transition disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${recovering ? 'animate-spin' : ''}`} />
            <span>{recovering ? 'Restoring...' : 'Emergency Recover'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

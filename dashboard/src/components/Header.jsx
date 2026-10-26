import React from 'react';
import { Activity, ShieldCheck, Download, RefreshCw, Server, AlertTriangle } from 'lucide-react';

export default function Header({ onExportReport, isPolling, onManualRefresh, activeIncident }) {
  return (
    <header className="border-b border-slate-800/80 bg-[#0D131F]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Title and Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-[#0D131F] rounded-[11px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                Fault<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Lens</span>
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Cloud Reliability Auditor
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Scenario-Based Chaos Replay, Incident Telemetry & Recovery Verification
            </p>
          </div>
        </div>

        {/* Status Indicators and Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Target Architecture Tag */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Target Microservice:</span>
            <span className="font-mono text-cyan-400 font-semibold">:5001</span>
          </div>

          {/* Engine Status Tag */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>Auditor Engine</span>
            <span className="font-mono text-emerald-400 font-semibold">:5000</span>
          </div>

          {/* Refresh Action */}
          <button
            onClick={onManualRefresh}
            title="Refresh Data"
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Export Report Action */}
          <button
            onClick={onExportReport}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit Report</span>
          </button>
        </div>

      </div>
    </header>
  );
}

import React from 'react';
import { 
  Activity, 
  LayoutDashboard, 
  Server, 
  Flame, 
  FileText, 
  Clock, 
  Download, 
  RefreshCw 
} from 'lucide-react';

export default function Navbar({ activeTab, onSelectTab, onExportReport, isPolling, onManualRefresh, metrics }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'applications', label: 'Applications', icon: Server, badge: metrics?.totalApplications },
    { id: 'experiments', label: 'Experiments', icon: Flame, badge: metrics?.totalAuditRuns },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'activity', label: 'Activity Log', icon: Clock }
  ];

  return (
    <header className="border-b border-slate-800/80 bg-[#0B0F19]/95 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Logo and Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-[#0B0F19] rounded-[11px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                Fault<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Lens</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                v2.0 Cloud Auditor
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Scenario-Based Failure Replay & Recovery Auditor
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 overflow-x-auto text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Tools & Export Button */}
        <div className="flex items-center gap-2.5">
          {/* Prober Pulse Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono">
            <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>Auditor :5000</span>
          </div>

          {/* Refresh Action */}
          <button
            onClick={onManualRefresh}
            title="Refresh Data"
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Download Logs & Export Report Action */}
          <button
            onClick={onExportReport}
            title="Download logs, telemetry, and audit post-mortems with API selection options"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-blue-600/20 transition active:scale-95 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Logs</span>
          </button>
        </div>

      </div>
    </header>
  );
}

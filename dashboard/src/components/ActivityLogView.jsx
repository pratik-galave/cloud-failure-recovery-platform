import React, { useState } from 'react';
import { Clock, Filter, AlertOctagon, CheckCircle2, Info, AlertTriangle, Download, Server } from 'lucide-react';

export default function ActivityLogView({ activityLogs = [], applications = [], onExportReport }) {
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterAppId, setFilterAppId] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = activityLogs.filter((log) => {
    const matchesSeverity = filterSeverity === 'ALL' || log.severity === filterSeverity;
    const matchesApp = filterAppId === 'ALL' || String(log.app_id) === String(filterAppId);
    const matchesSearch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.app_name && log.app_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.event_type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSeverity && matchesApp && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header and Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Cloud Auditor Activity Log
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable audit trail of monitoring transitions, incident detection, recovery, and chaos experiments
          </p>
        </div>

        {/* Filters, API Selector & Export Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Target App Filter */}
          {applications && applications.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Server className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <select
                value={filterAppId}
                onChange={(e) => setFilterAppId(e.target.value)}
                className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">All APIs</option>
                {applications.map(app => (
                  <option key={app.id} value={app.id} className="bg-slate-900 text-white">
                    App #{app.id} - {app.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-36 sm:w-44 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition font-mono"
          />

          {/* Severity Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {['ALL', 'INFO', 'WARN', 'ERROR', 'SUCCESS'].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2 py-1 rounded-lg font-mono font-bold text-[10px] transition ${
                  filterSeverity === sev
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Export / Download Logs Button */}
          <button
            onClick={() => onExportReport && onExportReport(filterAppId === 'ALL' ? 'all' : Number(filterAppId))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition active:scale-95"
            title="Open Export & Download Center with chosen API options"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Logs</span>
          </button>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 font-mono">
            No activity logs match your filter criteria.
          </div>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            {filteredLogs.map((log) => {
              const isError = log.severity === 'ERROR';
              const isWarn = log.severity === 'WARN';
              const isSuccess = log.severity === 'SUCCESS';

              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                    isError
                      ? 'bg-red-950/20 border-red-500/30'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : isSuccess
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-slate-950/60 border-slate-800/70'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isError
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : isSuccess
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {log.event_type}
                      </span>

                      {log.app_name && (
                        <span className="text-slate-400 text-[11px] font-sans">
                          [{log.app_name}]
                        </span>
                      )}

                      <span className="text-slate-500 text-[10px]">
                        ID #{log.id}
                      </span>
                    </div>

                    <p className="text-white font-sans font-medium text-xs mt-1">
                      {log.message}
                    </p>

                    {log.details && (
                      <p className="text-slate-400 text-[11px] font-mono leading-relaxed bg-slate-900/50 p-2 rounded-lg border border-slate-800/50 mt-1">
                        {log.details}
                      </p>
                    )}
                  </div>

                  <span className="text-slate-500 text-[11px] shrink-0 font-mono">
                    {new Date(log.created_at).toLocaleTimeString()} ({new Date(log.created_at).toLocaleDateString()})
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

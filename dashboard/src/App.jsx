import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import ActiveIncidentBanner from './components/ActiveIncidentBanner';
import OverviewView from './components/OverviewView';
import ApplicationsView from './components/ApplicationsView';
import ApplicationDetailView from './components/ApplicationDetailView';
import ExperimentsView from './components/ExperimentsView';
import ReportsView from './components/ReportsView';
import ActivityLogView from './components/ActivityLogView';
import RegisterAppModal from './components/RegisterAppModal';
import AuditReportModal from './components/AuditReportModal';
import { API_BASE } from './config';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'applications' | 'application-detail' | 'experiments' | 'reports' | 'activity'
  const [selectedAppId, setSelectedAppId] = useState(1);

  const [status, setStatus] = useState(null);
  const [applications, setApplications] = useState([]);
  const [probes, setProbes] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [auditRuns, setAuditRuns] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [targetReportId, setTargetReportId] = useState(null);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [exportModalAppId, setExportModalAppId] = useState('all');
  const [isPolling, setIsPolling] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleOpenExport = (appId = 'all') => {
    setExportModalAppId(appId);
    setIsReportOpen(true);
  };

  // Central telemetry poller
  const fetchTelemetry = useCallback(async () => {
    try {
      const [statusRes, appsRes, probesRes, metricsRes, runsRes, incidentsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/status`).then(r => r.json()),
        fetch(`${API_BASE}/applications`).then(r => r.json()),
        fetch(`${API_BASE}/probes/recent?limit=150`).then(r => r.json()),
        fetch(`${API_BASE}/metrics`).then(r => r.json()),
        fetch(`${API_BASE}/audit-runs?limit=30`).then(r => r.json()),
        fetch(`${API_BASE}/incidents?limit=25`).then(r => r.json()),
        fetch(`${API_BASE}/activity-logs?limit=50`).then(r => r.json())
      ]);

      setStatus(statusRes);
      setApplications(appsRes || []);
      setProbes(probesRes || []);
      setMetrics(metricsRes);
      setAuditRuns(runsRes || []);
      setIncidents(incidentsRes || []);
      setActivityLogs(logsRes || []);
      setErrorMsg(null);
    } catch (err) {
      console.error('[Dashboard Poll Error]', err);
      setErrorMsg('Cannot reach FaultLens Auditor Engine on port 5000. Is it running?');
    }
  }, []);

  // Polling loop every 1500ms
  useEffect(() => {
    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 1500);
    return () => clearInterval(timer);
  }, [fetchTelemetry]);

  // Navigate to application drill-down
  const handleSelectApp = (appId) => {
    setSelectedAppId(appId);
    setActiveTab('application-detail');
  };

  // Chaos trigger handler
  const handleTriggerChaos = async (scenarioKey, appId = 1) => {
    try {
      const res = await fetch(`${API_BASE}/chaos/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioKey, appId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Chaos Trigger Error: ${data.error || 'Failed'}`);
      }
      await fetchTelemetry();
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  // Emergency recover handler
  const handleEmergencyRecover = async (appId = 1) => {
    try {
      await fetch(`${API_BASE}/chaos/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId })
      });
      await fetchTelemetry();
    } catch (err) {
      alert(`Recovery Error: ${err.message}`);
    }
  };

  // Find active incident across all applications
  const activeIncident = applications.find(a => a.activeIncident)?.activeIncident || status?.activeIncident;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      
      {/* 1. Top Navbar with Page Tabs */}
      <Navbar
        activeTab={activeTab === 'application-detail' ? 'applications' : activeTab}
        onSelectTab={setActiveTab}
        onExportReport={() => handleOpenExport('all')}
        isPolling={isPolling && !errorMsg}
        onManualRefresh={fetchTelemetry}
        metrics={metrics}
      />

      {/* 2. Active Outage Banner (when any incident is detected) */}
      <ActiveIncidentBanner
        incident={activeIncident}
        targetStatus={metrics?.downApplications > 0 ? 'DOWN' : 'HEALTHY'}
        onEmergencyRecover={() => handleEmergencyRecover(activeIncident?.app_id || 1)}
      />

      {/* Backend connection warning */}
      {errorMsg && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 text-xs text-amber-300 text-center font-mono">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 3. Main Content Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        
        {activeTab === 'overview' && (
          <OverviewView
            status={status}
            metrics={metrics}
            probes={probes}
            applications={applications}
            incidents={incidents}
            activityLogs={activityLogs}
            onTriggerChaos={handleTriggerChaos}
            onSelectApp={handleSelectApp}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'applications' && (
          <ApplicationsView
            applications={applications}
            onSelectApp={handleSelectApp}
            onOpenRegisterModal={() => setIsRegisterOpen(true)}
            onAppDeleted={fetchTelemetry}
          />
        )}

        {activeTab === 'application-detail' && (
          <ApplicationDetailView
            appId={selectedAppId}
            onBack={() => setActiveTab('applications')}
            onTriggerChaos={handleTriggerChaos}
            onExportReport={handleOpenExport}
          />
        )}

        {activeTab === 'experiments' && (
          <ExperimentsView
            applications={applications}
            auditRuns={auditRuns}
            activeExperiment={status?.activeExperiment}
            onTriggerChaos={handleTriggerChaos}
            onViewReport={(runId) => {
              setTargetReportId(runId);
              setActiveTab('reports');
            }}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            auditRuns={auditRuns}
            incidents={incidents}
            metrics={metrics}
            targetReportId={targetReportId}
            onClearTargetReport={() => setTargetReportId(null)}
            onExportReport={handleOpenExport}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityLogView
            activityLogs={activityLogs}
            applications={applications}
            onExportReport={handleOpenExport}
          />
        )}

      </main>

      {/* 4. Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0B0F19] py-4 px-6 text-center text-xs text-slate-500 font-mono">
        FaultLens Cloud Reliability Auditor &bull; Multi-Application Chaos & Recovery Platform &bull; Node.js + React + SQLite + Docker
      </footer>

      {/* 5. Modals */}
      <RegisterAppModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onAppRegistered={fetchTelemetry}
      />

      <AuditReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        metrics={metrics}
        applications={applications}
        incidents={incidents}
        auditRuns={auditRuns}
        initialAppId={exportModalAppId}
      />

    </div>
  );
}

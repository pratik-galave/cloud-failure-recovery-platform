import React, { useState } from 'react';
import { X, Server, Plus, Loader2, AlertCircle, ShieldCheck, Clock } from 'lucide-react';
import { API_BASE } from '../config';

export default function RegisterAppModal({ isOpen, onClose, onAppRegistered }) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [healthEndpoint, setHealthEndpoint] = useState('/health');
  const [checkIntervalSeconds, setCheckIntervalSeconds] = useState(10);
  const [failureThreshold, setFailureThreshold] = useState(2);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Application Name is required.');
      return;
    }

    if (!baseUrl.trim() || !baseUrl.startsWith('http')) {
      setError('A valid base URL starting with http:// or https:// is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          healthEndpoint: healthEndpoint.trim() || '/health',
          checkIntervalSeconds: parseInt(checkIntervalSeconds, 10) || 10,
          failureThreshold: parseInt(failureThreshold, 10) || 2,
          description: description.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register application');
      }

      onAppRegistered(data.application);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131C31]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Register Test Application
              </h3>
              <p className="text-xs text-slate-400">
                Authorized microservice configuration with SSRF security and custom intervals
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Application Name *
            </label>
            <input
              type="text"
              placeholder="e.g., Payment Gateway or Inventory Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Base URL *
              </label>
              <input
                type="text"
                placeholder="http://localhost:5002"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Health Probe
              </label>
              <input
                type="text"
                placeholder="/health"
                value={healthEndpoint}
                onChange={(e) => setHealthEndpoint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Polling Interval and Failure Threshold Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Polling Interval (Seconds)
              </label>
              <input
                type="number"
                min="2"
                max="300"
                value={checkIntervalSeconds}
                onChange={(e) => setCheckIntervalSeconds(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500">Default: 10 seconds</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Failure Threshold (Streak)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={failureThreshold}
                onChange={(e) => setFailureThreshold(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500">Fails before Incident</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Service Description
            </label>
            <textarea
              rows="2"
              placeholder="Optional notes on the microservice role and cloud dependencies"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition resize-none"
            />
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/20 text-[11px] text-blue-300">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Protected by SSRF guard: Cloud metadata IPs and private ranges are blocked.</span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Application</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

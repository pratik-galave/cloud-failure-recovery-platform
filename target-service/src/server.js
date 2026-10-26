const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// In-memory service state tracking health and active fault conditions
const serviceState = {
  status: 'HEALTHY', // 'HEALTHY' | 'DEGRADED' | 'DOWN'
  faultType: null,    // null | 'LATENCY_SPIKE' | 'INTERNAL_ERROR' | 'SIMULATED_CRASH' | 'PAUSED'
  latencyMs: 0,
  errorMessage: null,
  injectedAt: null,
  autoRecoverTimer: null
};

// Logical test storage quota (Clearly labeled as a simulation)
const simulatedStorage = {
  isSimulated: true,
  warningThresholdPercent: 80,
  totalCapacityMb: 1000,
  usedMb: 350,
  status: 'NORMAL' // 'NORMAL' | 'WARNING_QUOTA_EXCEEDED'
};

// Helper to schedule self-healing recovery
function scheduleAutoRecovery(seconds) {
  if (serviceState.autoRecoverTimer) {
    clearTimeout(serviceState.autoRecoverTimer);
  }
  if (seconds && seconds > 0) {
    serviceState.autoRecoverTimer = setTimeout(() => {
      console.log(`[Auto-Recovery] Cooldown expired (${seconds}s). Restoring service to HEALTHY.`);
      resetToHealthy();
    }, seconds * 1000);
  }
}

// Reset state to healthy
function resetToHealthy() {
  if (serviceState.autoRecoverTimer) {
    clearTimeout(serviceState.autoRecoverTimer);
    serviceState.autoRecoverTimer = null;
  }
  serviceState.status = 'HEALTHY';
  serviceState.faultType = null;
  serviceState.latencyMs = 0;
  serviceState.errorMessage = null;
  serviceState.injectedAt = null;

  // Reset simulated storage
  simulatedStorage.usedMb = 350;
  simulatedStorage.status = 'NORMAL';
}

// Middleware: artificially delay response if latency fault is active
const handleLatencyMiddleware = (req, res, next) => {
  if (serviceState.status === 'DEGRADED' && serviceState.latencyMs > 0) {
    setTimeout(next, serviceState.latencyMs);
  } else {
    next();
  }
};

app.use(handleLatencyMiddleware);

// --- 1. Liveness & Health Probe Endpoint ---
// Standard endpoint monitored by cloud load balancers (e.g. AWS ALB, Kubernetes kubelet)
app.get('/health', (req, res) => {
  if (serviceState.status === 'DOWN') {
    return res.status(500).json({
      status: 'DOWN',
      faultType: serviceState.faultType,
      error: serviceState.errorMessage || 'Internal Server Outage',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  // Check if simulated storage quota exceeded warning threshold
  const usedPercent = Math.round((simulatedStorage.usedMb / simulatedStorage.totalCapacityMb) * 100);
  if (simulatedStorage.status === 'WARNING_QUOTA_EXCEEDED' || usedPercent >= simulatedStorage.warningThresholdPercent) {
    return res.status(200).json({
      status: 'DEGRADED',
      isSimulated: true,
      simulationType: 'STORAGE_QUOTA_EXCEEDED',
      warning: `[SIMULATED DATA] Storage quota warning: ${usedPercent}% used (threshold: ${simulatedStorage.warningThresholdPercent}%)`,
      storageUsage: {
        totalMb: simulatedStorage.totalCapacityMb,
        usedMb: simulatedStorage.usedMb,
        usedPercent,
        warningThreshold: simulatedStorage.warningThresholdPercent
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  if (serviceState.status === 'DEGRADED') {
    return res.status(200).json({
      status: 'DEGRADED',
      faultType: serviceState.faultType,
      warning: `High latency detected (${serviceState.latencyMs}ms)`,
      latencyMs: serviceState.latencyMs,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  return res.status(200).json({
    status: 'HEALTHY',
    service: 'target-order-api',
    uptime: Math.floor(process.uptime()),
    simulatedStorage: {
      isSimulated: true,
      usedPercent: Math.round((simulatedStorage.usedMb / simulatedStorage.totalCapacityMb) * 100),
      totalCapacityMb: simulatedStorage.totalCapacityMb
    },
    timestamp: new Date().toISOString()
  });
});

// --- 2. Workload / Business API Endpoint ---
app.get('/api/orders', (req, res) => {
  if (serviceState.status === 'DOWN') {
    return res.status(503).json({
      error: 'Service Unavailable',
      details: serviceState.errorMessage || 'Database connection failure'
    });
  }

  res.json({
    service: 'target-order-api',
    status: serviceState.status,
    totalOrders: 42,
    orders: [
      { id: 'ORD-101', item: 'Cloud Compute Instance', amount: 250, status: 'Fulfilled' },
      { id: 'ORD-102', item: 'Storage Volume (100GB)', amount: 45, status: 'Pending' },
      { id: 'ORD-103', item: 'Managed Database Cluster', amount: 480, status: 'Fulfilled' }
    ]
  });
});

// --- 3. Simulated Storage Quota Controls (Scenario 3) ---

// Inspect current simulated storage status
app.get('/api/storage/status', (req, res) => {
  const usedPercent = Math.round((simulatedStorage.usedMb / simulatedStorage.totalCapacityMb) * 100);
  res.json({
    isSimulated: true,
    notice: 'LABEL: This is simulated logical storage usage for resilience quota auditing.',
    totalCapacityMb: simulatedStorage.totalCapacityMb,
    usedMb: simulatedStorage.usedMb,
    usedPercent,
    warningThresholdPercent: simulatedStorage.warningThresholdPercent,
    status: simulatedStorage.status,
    isWarningTriggered: usedPercent >= simulatedStorage.warningThresholdPercent
  });
});

// Simulate crossing the storage quota threshold
app.post('/api/storage/simulate-usage', (req, res) => {
  const { usedMb = 880, autoRecoverSeconds = 12 } = req.body || {};
  simulatedStorage.usedMb = Number(usedMb);
  const usedPercent = Math.round((simulatedStorage.usedMb / simulatedStorage.totalCapacityMb) * 100);

  if (usedPercent >= simulatedStorage.warningThresholdPercent) {
    simulatedStorage.status = 'WARNING_QUOTA_EXCEEDED';
    console.warn(`[Storage Quota Breached] (SIMULATION) Storage at ${usedPercent}% capacity.`);
  }

  if (autoRecoverSeconds && autoRecoverSeconds > 0) {
    setTimeout(() => {
      console.log(`[Storage Auto-Heal] Resetting simulated storage usage to normal.`);
      simulatedStorage.usedMb = 350;
      simulatedStorage.status = 'NORMAL';
    }, autoRecoverSeconds * 1000);
  }

  res.json({
    message: `Simulated storage usage updated to ${usedMb}MB (${usedPercent}%)`,
    isSimulated: true,
    warningTriggered: simulatedStorage.status === 'WARNING_QUOTA_EXCEEDED',
    simulatedStorage
  });
});

// Reset simulated storage back to normal safe levels
app.post('/api/storage/reset', (req, res) => {
  simulatedStorage.usedMb = 350;
  simulatedStorage.status = 'NORMAL';
  console.log('[Storage Quota Reset] Simulated storage restored to 35% safe capacity.');
  res.json({
    message: 'Simulated storage quota reset to normal capacity (35%).',
    isSimulated: true,
    simulatedStorage
  });
});

// --- 4. Fault Injection Control Endpoints ---

// Inspect current internal fault state
app.get('/fault/status', (req, res) => {
  res.json({
    status: serviceState.status,
    faultType: serviceState.faultType,
    latencyMs: serviceState.latencyMs,
    errorMessage: serviceState.errorMessage,
    injectedAt: serviceState.injectedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    simulatedStorage
  });
});

// Inject Latency
app.post('/fault/latency', (req, res) => {
  const { latencyMs = 2500, autoRecoverSeconds = 10 } = req.body || {};
  serviceState.status = 'DEGRADED';
  serviceState.faultType = 'LATENCY_SPIKE';
  serviceState.latencyMs = Number(latencyMs);
  serviceState.errorMessage = null;
  serviceState.injectedAt = new Date().toISOString();

  scheduleAutoRecovery(autoRecoverSeconds);

  res.json({
    message: `Latency fault injected: ${latencyMs}ms`,
    serviceState: {
      status: serviceState.status,
      faultType: serviceState.faultType,
      latencyMs: serviceState.latencyMs,
      autoRecoverSeconds
    }
  });
});

// Inject 500 Error
app.post('/fault/error', (req, res) => {
  const { message = 'Downstream Dependency Outage (HTTP 500)', autoRecoverSeconds = 10 } = req.body || {};
  serviceState.status = 'DOWN';
  serviceState.faultType = 'INTERNAL_ERROR';
  serviceState.latencyMs = 0;
  serviceState.errorMessage = message;
  serviceState.injectedAt = new Date().toISOString();

  scheduleAutoRecovery(autoRecoverSeconds);

  res.json({
    message: 'HTTP 500 Outage fault injected',
    serviceState: {
      status: serviceState.status,
      faultType: serviceState.faultType,
      errorMessage: serviceState.errorMessage,
      autoRecoverSeconds
    }
  });
});

// Inject Container Pause (stops answering probes until unpaused)
app.post('/fault/pause', (req, res) => {
  const { autoRecoverSeconds = 10 } = req.body || {};
  serviceState.status = 'DOWN';
  serviceState.faultType = 'PAUSED';
  serviceState.errorMessage = 'Service Paused: Simulated Container Freezing (SIGSTOP)';
  serviceState.injectedAt = new Date().toISOString();

  scheduleAutoRecovery(autoRecoverSeconds);

  console.warn('[Fault Injected] Service Paused (Simulated Container Freeze)');
  res.json({
    message: 'Simulated container pause injected',
    serviceState
  });
});

// Inject Crash
app.post('/fault/crash', (req, res) => {
  const { type = 'simulated', autoRecoverSeconds = 12 } = req.body || {};

  if (type === 'hard') {
    res.json({ message: 'Hard crash triggered. Process exiting now.' });
    console.error('[Hard Crash] Process exit (code 1) triggered by chaos experiment.');
    setTimeout(() => {
      process.exit(1);
    }, 500);
    return;
  }

  serviceState.status = 'DOWN';
  serviceState.faultType = 'SIMULATED_CRASH';
  serviceState.latencyMs = 0;
  serviceState.errorMessage = 'Fatal Error: Process Terminated (Simulated Container Crash)';
  serviceState.injectedAt = new Date().toISOString();

  scheduleAutoRecovery(autoRecoverSeconds);

  res.json({
    message: 'Simulated process crash fault injected',
    serviceState
  });
});

// Recover / Reset to Normal
app.post('/fault/recover', (req, res) => {
  resetToHealthy();
  console.log('[Recovery Triggered] Service restored to HEALTHY state.');
  res.json({
    message: 'Service state reset to HEALTHY',
    serviceState: {
      status: serviceState.status,
      uptime: Math.floor(process.uptime())
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(`[Target Service] Running on port ${PORT} (PID: ${process.pid})`);
  console.log(`[Target Service] Health probe: http://localhost:${PORT}/health`);
  console.log(`[Target Service] Storage status: http://localhost:${PORT}/api/storage/status`);
});

process.on('SIGTERM', () => {
  server.close(() => console.log('[Target Service] Terminated gracefully'));
});

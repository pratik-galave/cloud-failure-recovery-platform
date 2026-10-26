# FaultLens: Comprehensive Feature Specification & Architecture Guide

> **Document Type:** System Architecture & Feature Capabilities Specification  
> **Target Audience:** AI Engineering Agents, Cloud Architects, and Systems Developers  
> **System Name:** FaultLens (Scenario-Based Cloud Failure Replay & Recovery Auditor)  
> **Technology Stack:** Node.js (v20/22/24), Express, React 19, Vite, Tailwind CSS, SQLite (`node:sqlite`), Docker, Docker Compose

---

## 1. Executive Summary & Purpose

**FaultLens** is an open-architecture, scenario-based chaos engineering and site reliability auditing platform. It demonstrates foundational cloud computing resilience principles:
- **Service Isolation & Independent Failure Domains**: The monitoring plane (Auditor Engine) is completely decoupled from the application plane (Target Microservice).
- **Automated Synthetic Health Probing**: Kubernetes-style liveness checks polling target endpoints periodically to measure round-trip latency and HTTP response codes.
- **Controlled Fault Injection (Chaos Engineering)**: Deterministic, repeatable failure simulation (latency spikes, HTTP 500 crashes, container termination, and logical storage exhaustion).
- **Incident State Machine & Anti-Flapping**: Two-consecutive-failure threshold to open incidents and two-consecutive-success threshold to resolve incidents.
- **Objective SLA & Recovery Auditing**: Automated measurement of **Mean Time To Detect (MTTD)** and **Mean Time To Recover (MTTR)** against predefined Service Level Agreements.
- **Deterministic Post-Mortem Intelligence**: Transparent rule-based heuristics evaluating failure detection efficiency and recovery margins without fabricated or probabilistic "AI" claims.
- **Multi-Format Exportability**: Exporting audit reports to machine-readable JSON, spreadsheet-ready CSV, and high-contrast printable PDF.

---

## 2. High-Level System Architecture

FaultLens is structured as a decoupled 3-tier distributed system with local host and multi-container Docker support:

```text
+-------------------------------------------------------------------------------------------------+
|                                 OPERATIONS CONSOLE (React + Vite)                               |
|        [Live Health HUD]   [Telemetry Sparkline]   [Chaos Control Room]   [Audit Reports]       |
+------------------------------------------------+------------------------------------------------+
                                                 | HTTP REST / Polling (every 1500ms)
                                                 v
+-------------------------------------------------------------------------------------------------+
|                               FAULTLENS AUDITOR ENGINE (Node.js + Express)                      |
|                                                                                                 |
|   +-----------------------+    +-----------------------+    +-------------------------------+   |
|   | Unified Master Clock  |    | Restricted Docker     |    | Incident & SLA                |   |
|   | (1000ms Prober Loop)  |    | Controller (execFile) |    | Auditor (MTTD / MTTR Engine)  |   |
|   +-----------+-----------+    +-----------+-----------+    +---------------+---------------+   |
|               |                            |                                |                   |
|               |                            |                                v                   |
|               |                            |                +-------------------------------+   |
|               |                            |                | SQLite Database               |   |
|               |                            |                | (faultlens.db in /app/data)   |   |
|               |                            |                +-------------------------------+   |
+---------------|----------------------------|----------------------------------------------------+
                | Out-of-band GET /health    | Inject Fault / docker stop
                v                            v
+-------------------------------------------------------------------------------------------------+
|                         TARGET MICROSERVICE (Order & Catalog API)                               |
|                                                                                                 |
|   Endpoints:                                                                                    |
|     - GET  /health          --> Returns 200 OK, 500 OUTAGE, or DEGRADED status                  |
|     - GET  /api/orders      --> Simulated e-commerce workload (orders, amounts, statuses)       |
|     - POST /fault/latency   --> Injects artificial delays (e.g. 2000ms network congestion)     |
|     - POST /fault/error     --> Simulates downstream database / 500 crash                       |
|     - POST /fault/crash     --> Simulates process exit / container failure                      |
|     - POST /fault/recover   --> Manual / automated self-healing cooldown trigger                |
|     - GET  /api/storage/*   --> Safe logical storage quota warning simulation (>80% used)       |
+-------------------------------------------------------------------------------------------------+
```

### Component Port Mapping
| Component | Container Name | Host Port | Protocol | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| **Dashboard** | `faultlens-dashboard` | **5173** | HTTP | React SPA served by production Nginx Alpine |
| **Auditor Backend** | `faultlens-auditor-backend` | **5000** | HTTP | Express REST API, health prober, and SQLite engine |
| **Target Service** | `faultlens-target-service` | **5001** | HTTP | Microservice running business endpoints & chaos hooks |

---

## 3. Detailed Feature Breakdown by Subsystem

### 3.1. Target Microservice (`target-service`)

The target service represents a real-world microservice under monitoring:
1. **Isolated State Machine**: Maintains in-memory status (`HEALTHY`, `DEGRADED`, `DOWN`), fault type, artificial latency values, and auto-recovery timers.
2. **Business Workload (`GET /api/orders`)**:
   - Returns realistic e-commerce order records (`ORD-101`, `ORD-102`, `ORD-103`).
   - If in `DOWN` status, immediately returns `HTTP 503 Service Unavailable`.
3. **Liveness Probe Endpoint (`GET /health`)**:
   - Returns `HTTP 200` with uptime, service name, and storage stats when healthy.
   - Returns `HTTP 200` with status `DEGRADED` when latency is high or storage quota is breached.
   - Returns `HTTP 500` with error details when status is `DOWN`.
4. **Latency Middleware**:
   - Express middleware intercepting incoming requests and inserting artificial `setTimeout` delays when the service is degraded.
5. **Self-Healing Cooldown (`scheduleAutoRecovery`)**:
   - Accepts an optional duration in seconds (e.g., `autoRecoverSeconds: 15`). When expired, automatically restores the service to `HEALTHY`.
6. **Logical Storage Quota Simulation (`/api/storage/*`)**:
   - Safely tests disk exhaustion alerting without corrupting the host filesystem.
   - Total capacity: 1000MB; warning threshold: 80% (800MB).
   - Injects usage up to 880MB (88%), triggering `DEGRADED` health checks, and auto-resets to 350MB (35%). All payloads are explicitly labeled `[SIMULATED DATA]`.

---

### 3.2. Auditor Engine & Telemetry Prober (`auditor-backend`)

The auditor engine operates out-of-band to inspect, record, and verify target service resilience:
1. **Unified Master Clock Scheduler (ADR-011)**:
   - Employs a single 1000ms loop evaluating all active applications.
   - Eliminates duplicate timer leaks and prevents probe storms.
2. **In-Flight Concurrency Guard**:
   - Uses an `inFlightProbes` Set to ensure slow or hanging HTTP requests never spawn concurrent duplicate probes for the same application.
3. **Consecutive Failure / Recovery State Machine (ADR-007)**:
   - **Failure Detection**: Requires **2 consecutive failed probes** before flagging an incident as `OPEN`. Prevents alert flapping from transient network blips.
   - **Recovery Verification**: Requires **2 consecutive successful probes** before closing an incident and marking the service restored.
4. **SSRF & Cloud Metadata Protection (ADR-012)**:
   - Validates all application target URLs against an IP security filter.
   - Strictly blocks AWS/GCP/Azure link-local metadata endpoints (`169.254.169.254`, `metadata.google.internal`), private RFC 1918 subnets, and loopback exploits, while explicitly allowlisting designated local demo ports.
5. **Real-Time Telemetry Storage**:
   - Every probe captures: `app_id`, `timestamp`, `status_code`, `latency_ms` (explicitly `NULL` on timeouts to differentiate from 0ms), `status_text`, `is_healthy`, and sanitized `error_message`.
6. **Incident Lifecycle Tracker**:
   - Records `started_at`, `detected_at`, `resolved_at`, calculated `duration_seconds`, `trigger_cause`, and resolution notes in SQLite.

---

### 3.3. Chaos Experimentation & 4-Phase Lifecycle (ADR-014)

Every chaos experiment transitions through **4 distinct verifiable phases**, storing exact millisecond timestamps:

```text
[ Phase 1: INJECTED ]
  Action: docker stop container or POST /fault/error
  Timestamp: injected_at
         │
         ▼
[ Phase 2: DETECTED ]
  Event: Prober detects 2 consecutive probe failures
  Timestamp: detected_at
  Metric: MTTD (Mean Time To Detect) = detected_at - injected_at
         │
         ▼
[ Phase 3: RECOVERY ATTEMPTED ]
  Action: docker start / restart or self-healing cooldown kicks in
  Timestamp: recovery_attempted_at
         │
         ▼
[ Phase 4: RECOVERY VERIFIED ]
  Event: Prober observes 2 consecutive HTTP 200 healthy probes
  Timestamp: verified_at
  Metric: MTTR (Mean Time To Recover) = verified_at - detected_at
  SLA Assessment: Passed if MTTR <= scenario.sla_threshold_seconds
```

#### Pre-Configured Scenarios:
1. **Scenario 1: `DOCKER_SERVICE_UNAVAILABLE`**:
   - Stops the dedicated Docker test container (`docker stop faultlens-target-service`).
   - Validates prober detection of total connection refusal.
   - Restarts container (`docker start faultlens-target-service`) and verifies boot recovery.
   - SLA Target: $\le 18.0\text{s}$.
2. **Scenario 2: `AUTO_RECOVERY_TEST`**:
   - Injects downstream HTTP 500 error hook with a 6-second internal cooldown timer.
   - Measures time until internal self-healing restores HTTP 200 responses.
   - SLA Target: $\le 15.0\text{s}$.
3. **Scenario 3: `STORAGE_QUOTA_SIMULATION`**:
   - Injects simulated disk usage breach (880MB / 88% utilized).
   - Validates that the prober flags `DEGRADED` status without marking total outage.
   - Auto-recovers to 35% utilization and verifies restoration.
   - SLA Target: $\le 12.0\text{s}$.

#### Restricted Docker Controller (ADR-013):
- Uses Node.js `child_process.execFile` with argument arrays to prevent shell command injection.
- Container target is strictly hardcoded to `faultlens-target-service`.
- Command actions strictly allowlisted: `['stop', 'start', 'restart', 'pause', 'unpause']`.
- **Dual-Mode Graceful Fallback**: If Docker is not running or the daemon is unreachable, the system automatically falls back to in-process HTTP hook simulation (`SAFE_PROCESS_SIMULATION`).

---

### 3.4. Multi-Application Registration (Service Catalog - ADR-010)

FaultLens is not limited to a single static microservice:
- **Dynamic Application Registration**: Users can register arbitrary web services via the UI or `POST /api/applications`.
- **Customizable Resilience Thresholds**:
  - `check_interval_seconds` (default: 10s)
  - `failure_threshold` (default: 2 fails)
  - `timeout_ms` (default: 4000ms)
  - `degraded_latency_threshold_ms` (default: 1500ms)
- **Partitioned Data Architecture**:
  - Telemetry probes (`probes.app_id`), incidents (`incidents.app_id`), and audit runs (`audit_runs.app_id`) are foreign-key partitioned, allowing isolated drill-downs and reports per microservice.

---

### 3.5. Post-Mortem Intelligence & Multi-Format Export Engine

#### Deterministic Rule-Based Heuristics (ADR-016):
FaultLens intentionally avoids fake probabilistic "AI predictions" in favor of deterministic engineering heuristics:
1. **Detection Efficiency**:
   $$\text{Detection Efficiency} = \begin{cases} \text{Optimal (Immediate)} & \text{if MTTD} \le 2.5\text{s} \\ \text{Standard Buffer} & \text{otherwise} \end{cases}$$
2. **SLA Margin Analysis**:
   $$\text{Margin} = \text{SLA Target Seconds} - \text{MTTR Seconds}$$
3. **Infrastructure Isolation Verification**: Confirms container boundary isolation vs process-level failure.

#### Export Formats (ADR-017):
- **Structured JSON (`/api/audit-runs/:id/export/json`)**: Full machine-readable export with timestamps, raw event logs, and status transitions.
- **Spreadsheet CSV (`/api/audit-runs/:id/export/csv` & `/api/audit-runs/export/csv`)**: RFC-compliant CSV suitable for auditing in Microsoft Excel or Google Sheets.
- **Printable Executive PDF (`window.print()`)**: High-contrast `@media print` CSS stylesheet hiding interactive buttons and rendering a crisp, professional post-mortem brief.

---

### 3.6. Operations Console Dashboard (React + Vite + Tailwind CSS)

The dashboard provides a real-time, glassmorphic operations console:
1. **Health HUD (Global KPIs)**:
   - Live target health indicator (Pulsing green `HEALTHY`, yellow `DEGRADED`, red `DOWN`).
   - Overall Availability (Uptime %) calculated over total recorded probes.
   - Mean Time To Recover (Average MTTR across resolved outages).
   - Resilience SLA Pass Rate percentage.
2. **Telemetry Sparkline Chart (`LatencyChart.jsx`)**:
   - Interactive SVG bar chart showing the last 40 health probe latencies.
   - Color-coded bars: Green (<1000ms), Amber (>1000ms degraded), Red (unreachable/timeout).
   - Interactive hover cards displaying exact probe latency, HTTP status code, and timestamp.
3. **Active Incident Alert Banner (`ActiveIncidentBanner.jsx`)**:
   - Automatically appears when any active incident is detected.
   - Real-time elapsed outage counter.
   - Instant **"Trigger Emergency Recovery"** button.
4. **Chaos Control Room (`ExperimentsView.jsx`)**:
   - Scenario cards with destructive action confirmation modals.
   - Real-time 4-phase status tracker displaying active timestamps and event logs as chaos unfolds.
5. **Application Management (`ApplicationsView.jsx` & `ApplicationDetailView.jsx`)**:
   - Cards displaying all registered microservices with live latency and probe intervals.
   - Modal to register new applications with SSRF validation.
   - Deep-dive view per application showing dedicated latency charts and isolated incident history.
6. **Chronological Activity Log (`ActivityLogView.jsx`)**:
   - Real-time event stream recording prober events, chaos injections, recoveries, and SLA verdicts.

---

## 4. Database Schema Reference (SQLite: `faultlens.db`)

Stored using Node's built-in `node:sqlite` in WAL (Write-Ahead Logging) mode:

```sql
-- 1. Registered Applications Catalog
CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL UNIQUE,
  health_endpoint TEXT NOT NULL DEFAULT '/health',
  check_interval_seconds INTEGER NOT NULL DEFAULT 10,
  failure_threshold INTEGER NOT NULL DEFAULT 2,
  timeout_ms INTEGER NOT NULL DEFAULT 4000,
  degraded_latency_threshold_ms INTEGER NOT NULL DEFAULT 1500,
  description TEXT,
  created_at TEXT NOT NULL,
  last_successful_check TEXT,
  last_checked_at TEXT,
  current_status TEXT NOT NULL DEFAULT 'INITIALIZING',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- 2. Raw Synthetic Health Telemetry
CREATE TABLE probes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER DEFAULT 1,
  timestamp TEXT NOT NULL,
  status_code INTEGER,
  latency_ms REAL, -- Explicitly NULL if unreachable (prevents 0ms confusion)
  status_text TEXT,
  is_healthy INTEGER,
  error_message TEXT
);

-- 3. Incident Lifecycle Records
CREATE TABLE incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER DEFAULT 1,
  incident_type TEXT NOT NULL,
  status TEXT NOT NULL, -- 'OPEN' or 'RESOLVED'
  started_at TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolved_at TEXT,
  duration_seconds REAL,
  trigger_cause TEXT,
  notes TEXT
);

-- 4. Chaos Experiment Audit Runs (4-Phase Timestamps)
CREATE TABLE audit_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER DEFAULT 1,
  scenario_id TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  injected_at TEXT,
  detected_at TEXT,
  recovery_attempted_at TEXT,
  verified_at TEXT,
  mttd_seconds REAL,
  mttr_seconds REAL,
  sla_threshold_seconds REAL,
  sla_passed INTEGER,
  execution_mode TEXT DEFAULT 'SAFE_PROCESS_SIMULATION',
  report_summary TEXT,
  event_logs TEXT,
  final_outcome TEXT
);

-- 5. Chronological Audit Trail
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER DEFAULT 1,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);
```

---

## 5. REST API Reference

| Method | Endpoint | Description | Request Body / Query Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Auditor process health & uptime | None |
| `GET` | `/api/status` | Global system status, active experiments & applications | None |
| `GET` | `/api/applications` | List registered applications with current health | None |
| `POST` | `/api/applications` | Register new microservice with SSRF validation | `{ name, baseUrl, healthEndpoint, ... }` |
| `GET` | `/api/applications/:id` | Detailed app stats, recent probes & incidents | `id` (URL parameter) |
| `DELETE`| `/api/applications/:id`| Deregister an application (App #1 protected) | `id` (URL parameter) |
| `GET` | `/api/probes/recent` | Recent telemetry probes for sparklines | `?limit=40&appId=1` |
| `GET` | `/api/metrics` | High-level reliability KPIs (Uptime %, MTTR) | None |
| `GET` | `/api/incidents` | Incident history log | `?limit=25&appId=1` |
| `GET` | `/api/activity-logs` | Chronological event audit stream | `?limit=50&appId=1` |
| `GET` | `/api/scenarios` | List allowed controlled failure scenarios | None |
| `POST` | `/api/chaos/trigger` | Launch a controlled failure experiment | `{ scenarioKey, appId }` |
| `POST` | `/api/chaos/recover` | Trigger manual emergency recovery signal | `{ appId }` |
| `GET` | `/api/audit-runs` | List historical resilience audit runs | `?limit=30&appId=1` |
| `GET` | `/api/audit-runs/:id` | View single audit report and timestamps | `id` (URL parameter) |
| `GET` | `/api/audit-runs/:id/export/json` | Download audit run post-mortem as JSON | `id` (URL parameter) |
| `GET` | `/api/audit-runs/:id/export/csv` | Download audit run post-mortem as CSV | `id` (URL parameter) |
| `GET` | `/api/audit-runs/export/csv` | Download all audit runs as aggregate CSV | None |

---

## 6. Deployment & Runtime Modes

FaultLens supports **two independent operational execution modes**:

### Mode A: Multi-Container Docker Stack (`start-docker.ps1`)
- Runs all 3 tiers inside isolated Linux user-spaces orchestrated via `docker-compose.yml`.
- Leverages Docker internal DNS (`http://target-service:5001`).
- Mounts named volume `faultlens-data:/app/data` ensuring SQLite audit history survives container restarts.
- Executes `wget` spider health checks every 5 seconds to manage Docker container liveness.

### Mode B: Zero-Docker Native Local Development (`start-local.ps1`)
- Launches all 3 services natively on Windows via PowerShell:
  1. Target Service on Port 5001
  2. Auditor Backend on Port 5000
  3. Vite Dev Server on Port 5173
- In this mode, the restricted Docker controller uses the host's native `docker` CLI directly to stop/start test containers, or seamlessly falls back to safe in-process HTTP hooks.

---

## 7. Roadmap & Potential Agent Extensions

If extending or pairing with this system, high-value avenues include:
1. **Dynamic Alerting Integrations**: Adding Webhook / Slack / PagerDuty dispatchers in [monitor.js](file:///c:/Users/Sanket/Desktop/restart/cloud%20project/auditor-backend/src/monitor.js) when consecutive probe failures exceed thresholds.
2. **Kubernetes CRD / Operator**: Porting the auditor probe loop into a custom Kubernetes controller observing custom resources (`ChaosExperiment`).
3. **Distributed Tracing (OpenTelemetry)**: Attaching OpenTelemetry trace headers (`traceparent`) to probes to correlate network latency with internal target service spans.
4. **Automated Rollback Verification**: Integrating with GitHub Actions or ArgoCD to audit canary deployments and automatically trigger rollbacks if MTTD/MTTR breaches SLAs.

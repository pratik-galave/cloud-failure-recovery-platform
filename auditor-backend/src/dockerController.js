const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// Strict safety allowlist: only specific actions against the dedicated test container
const ALLOWED_DOCKER_ACTIONS = new Set(['stop', 'start', 'restart', 'pause', 'unpause']);
const ALLOWED_CONTAINER_NAME = 'faultlens-target-service';

/**
 * Checks if Docker CLI is installed and the daemon is reachable.
 */
async function checkDockerAvailability() {
  try {
    const { stdout } = await execFileAsync('docker', ['ps', '--format', '{{.Names}}'], { timeout: 3000 });
    const runningContainers = stdout.trim().split('\n').map(s => s.trim()).filter(Boolean);
    const isTargetRunning = runningContainers.includes(ALLOWED_CONTAINER_NAME);

    return {
      available: true,
      daemonOnline: true,
      targetContainerRunning: isTargetRunning,
      runningContainers
    };
  } catch (err) {
    return {
      available: false,
      daemonOnline: false,
      targetContainerRunning: false,
      error: err.message
    };
  }
}

/**
 * Executes a privileged Docker container failure or recovery action with strict parameters.
 *
 * Safety Guarantees:
 * 1. Action MUST be one of: stop, start, restart, pause, unpause.
 * 2. Container name is NEVER accepted from user input; it is strictly locked to faultlens-target-service.
 * 3. Uses execFile with an argument array (prevents shell command injection).
 */
async function executeRestrictedDockerAction(action) {
  const normalizedAction = (action || '').toLowerCase().trim();

  if (!ALLOWED_DOCKER_ACTIONS.has(normalizedAction)) {
    throw new Error(`Security Violation: Action "${action}" is not permitted. Allowed actions: ${Array.from(ALLOWED_DOCKER_ACTIONS).join(', ')}`);
  }

  const dockerStatus = await checkDockerAvailability();
  if (!dockerStatus.available) {
    throw new Error(`Docker Daemon Unreachable: ${dockerStatus.error || 'Docker engine is offline.'}`);
  }

  console.log(`[Docker Controller] Executing allowlisted command: docker ${normalizedAction} ${ALLOWED_CONTAINER_NAME}`);

  try {
    const { stdout, stderr } = await execFileAsync('docker', [normalizedAction, ALLOWED_CONTAINER_NAME], {
      timeout: 10000
    });

    return {
      success: true,
      action: normalizedAction,
      container: ALLOWED_CONTAINER_NAME,
      output: stdout.trim(),
      stderr: stderr.trim()
    };
  } catch (err) {
    throw new Error(`Docker execution failed for "${normalizedAction}": ${err.message}`);
  }
}

module.exports = {
  checkDockerAvailability,
  executeRestrictedDockerAction,
  ALLOWED_DOCKER_ACTIONS,
  ALLOWED_CONTAINER_NAME
};

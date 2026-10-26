const { URL } = require('url');

// Explicitly authorized local demo targets (for college presentation and container networking)
const DEFAULT_ALLOWED_LOCAL_TARGETS = [
  'localhost:5001',
  'localhost:5002',
  'localhost:5003',
  '127.0.0.1:5001',
  '127.0.0.1:5002',
  '127.0.0.1:5003',
  'target-service:5001'
];

// Blocked Cloud Metadata IP addresses and hostnames (AWS, GCP, Azure, OpenStack, etc.)
const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.goog',
  '100.100.100.200',
  '169.254.169.250',
  '169.254.169.251',
  '169.254.169.252',
  '169.254.169.253'
]);

function isPrivateOrLoopbackIP(ip) {
  // IPv4 Loopback
  if (ip.startsWith('127.')) return true;
  // IPv4 Link-Local (APIPA)
  if (ip.startsWith('169.254.')) return true;
  // IPv4 Private Class A: 10.0.0.0/8
  if (ip.startsWith('10.')) return true;
  // IPv4 Private Class B: 172.16.0.0/12 (172.16 - 172.31)
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true; // Private Class C: 192.168.0.0/16
    if (parts[0] === 0) return true; // 0.0.0.0
  }
  // IPv6 loopback & link-local
  if (ip === '::1' || ip.toLowerCase().startsWith('fe80:')) return true;

  return false;
}

/**
 * Validates a target URL against SSRF vulnerabilities while allowing authorized demo microservices.
 *
 * @param {string} inputUrl - The base URL supplied by the user.
 * @returns {{ valid: boolean, error?: string, sanitizedUrl?: string }}
 */
function validateTargetUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string.' };
  }

  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch (e) {
    return { valid: false, error: `Malformed URL format: ${e.message}` };
  }

  // 1. Enforce HTTP/HTTPS protocols only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Forbidden protocol "${parsed.protocol}". Only http: and https: are permitted.` };
  }

  // 2. Prevent embedded credentials (e.g. http://admin:password@target)
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with embedded credentials (user:pass@host) are prohibited.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const hostWithPort = parsed.port ? `${hostname}:${parsed.port}` : hostname;

  // 3. Block Cloud Metadata IP / Hostnames
  if (BLOCKED_METADATA_HOSTS.has(hostname) || hostname.endsWith('.metadata.google.internal')) {
    return { valid: false, error: `SSRF Violation: Access to cloud metadata service (${hostname}) is strictly blocked.` };
  }

  // 4. Check if the target is an authorized local demo microservice
  const isAuthorizedLocalDemo = DEFAULT_ALLOWED_LOCAL_TARGETS.includes(hostWithPort) ||
                                (process.env.TARGET_SERVICE_URL && process.env.TARGET_SERVICE_URL.includes(hostWithPort));

  if (isAuthorizedLocalDemo) {
    return {
      valid: true,
      sanitizedUrl: `${parsed.protocol}//${parsed.host}`
    };
  }

  // 5. For remote user-supplied URLs: block loopback, link-local, and private RFC-1918 networks
  if (hostname === 'localhost' || isPrivateOrLoopbackIP(hostname)) {
    return {
      valid: false,
      error: `SSRF Violation: Target host "${hostname}" resolves to a restricted local/private network. Only authorized demo ports (${DEFAULT_ALLOWED_LOCAL_TARGETS.join(', ')}) are permitted.`
    };
  }

  return {
    valid: true,
    sanitizedUrl: `${parsed.protocol}//${parsed.host}`
  };
}

/**
 * Strips potential API tokens or passwords from error logs.
 */
function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return '';
  return msg
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]')
    .replace(/(key=|token=|password=|secret=)[^&\s]+/gi, '$1[REDACTED]');
}

module.exports = {
  validateTargetUrl,
  sanitizeErrorMessage,
  DEFAULT_ALLOWED_LOCAL_TARGETS
};

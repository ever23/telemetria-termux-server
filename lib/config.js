const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch (_) {}
}

loadDotEnv();

module.exports = {
  port: parseInt(process.env.PORT || '3055', 10),
  sshPort: parseInt(process.env.SSH_PORT || '8022', 10),
  adbHostLocal: process.env.ADB_HOST_LOCAL || '127.0.0.1:5555',
  adbHostRemote: process.env.ADB_HOST_REMOTE || '127.0.0.1:5555',
  scriptPath: process.env.SCRIPT_PATH || './scripts/screen_control.sh',
  historyMaxPoints: parseInt(process.env.HISTORY_MAX_POINTS || '20', 10),
  cacheTtlMs: parseInt(process.env.CACHE_TTL_MS || '2000', 10),
  // Control de acceso (el hash se genera con "npm run set-password")
  authPasswordHash: process.env.AUTH_PASSWORD_HASH || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionDays: parseInt(process.env.SESSION_DAYS || '7', 10),
  // Opcionales (si están vacíos, se autodetectan con getprop / os / crontab / pm2)
  deviceName: process.env.DEVICE_NAME || '',
  socName: process.env.SOC_NAME || '',
  osName: process.env.OS_NAME || '',
  serverIp: process.env.SERVER_IP || '',
  termuxUser: process.env.TERMUX_USER || '',
  tunnelUrl: process.env.TUNNEL_URL || '',
  powerSource: process.env.POWER_SOURCE || '5V UPS'
};

const { exec } = require('child_process');
const { formatDuration } = require('./system');
const config = require('./config');

let cachedPm2 = null;
let lastPm2Check = 0;

function runPm2Jlist() {
  return new Promise((resolve) => {
    exec('pm2 jlist', { timeout: 3000, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      try {
        const startIdx = stdout.indexOf('[');
        const endIdx = stdout.lastIndexOf(']');
        if (startIdx === -1 || endIdx === -1) return resolve(null);
        const list = JSON.parse(stdout.slice(startIdx, endIdx + 1));
        resolve(Array.isArray(list) ? list : null);
      } catch (_) {
        resolve(null);
      }
    });
  });
}

async function getPm2Processes() {
  const now = Date.now();
  if (cachedPm2 && now - lastPm2Check < 3000) {
    return cachedPm2;
  }

  const rawList = await runPm2Jlist();
  if (rawList && rawList.length > 0) {
    const mapped = rawList.map((proc) => {
      const env = proc.pm2_env || {};
      const monit = proc.monit || {};
      const uptimeSec = env.pm_uptime ? Math.max(0, Math.floor((now - env.pm_uptime) / 1000)) : 0;
      const memMb = monit.memory ? +(monit.memory / 1024 / 1024).toFixed(1) : 0;
      const name = proc.name || 'process';
      const procPort = env.PORT || (env.env && env.env.PORT);

      let role = `PID ${proc.pid || '-'}`;
      if (procPort) {
        role = `Node :${procPort}`;
      } else if (env.pm_exec_path) {
        const base = env.pm_exec_path.split(/[\\/]/).pop();
        role = `${base} (PID ${proc.pid || '-'})`;
      }

      return {
        id: proc.pm_id ?? 0,
        name,
        pid: proc.pid || 0,
        role,
        status: env.status || 'online',
        memoryMb: memMb,
        cpu: monit.cpu ?? 0,
        restarts: env.restart_time ?? 0,
        uptime: formatDuration(uptimeSec)
      };
    });

    cachedPm2 = mapped;
    lastPm2Check = now;
    return mapped;
  }

  // Fallback genérico si PM2 no tiene procesos activos en entorno de prueba
  const mem = process.memoryUsage();
  const selfMem = +(
    (process.platform === 'win32' ? mem.heapUsed + mem.external : mem.rss) /
    1024 /
    1024
  ).toFixed(1);
  const selfUptime = formatDuration(process.uptime());

  const fallback = [
    {
      id: 0,
      name: 'termux-telemetry',
      pid: process.pid,
      role: `Dashboard :${config.port || 3055}`,
      status: 'online',
      memoryMb: selfMem,
      cpu: 0.1,
      restarts: 0,
      uptime: selfUptime
    }
  ];

  cachedPm2 = fallback;
  lastPm2Check = now;
  return fallback;
}

module.exports = {
  getPm2Processes
};

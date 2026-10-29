const { execFile } = require('child_process');
const { getAdbHost } = require('./adb');

let cachedProcData = null;
let lastProcFetch = 0;

function execAdb(args, timeout = 3500) {
  return new Promise((resolve) => {
    execFile('adb', args, { timeout, windowsHide: true }, (err, stdout) => {
      if (err) return resolve('');
      resolve(stdout || '');
    });
  });
}

function parseTopOutput(raw) {
  if (!raw) return null;
  const lines = raw.split('\n');
  const processes = [];
  let summary = {
    totalTasks: 0,
    runningTasks: 0,
    swapTotalMb: 0,
    swapUsedMb: 0,
    swapPercent: 0
  };

  let inTable = false;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('Tasks:')) {
      const totalM = line.match(/(\d+)\s+total/);
      const runM = line.match(/(\d+)\s+running/);
      if (totalM) summary.totalTasks = parseInt(totalM[1], 10);
      if (runM) summary.runningTasks = parseInt(runM[1], 10);
      continue;
    }

    if (line.startsWith('Swap:')) {
      const totM = line.match(/(\d+)K\s+total/i);
      const usedM = line.match(/(\d+)K\s+used/i);
      if (totM && usedM) {
        const tot = Math.round(parseInt(totM[1], 10) / 1024);
        const usd = Math.round(parseInt(usedM[1], 10) / 1024);
        summary.swapTotalMb = tot;
        summary.swapUsedMb = usd;
        summary.swapPercent = tot > 0 ? Math.round((usd / tot) * 100) : 0;
      }
      continue;
    }

    if (line.includes('PID') && line.includes('USER') && line.includes('ARGS')) {
      inTable = true;
      continue;
    }

    if (inTable) {
      // 22429 u0_a217 20 0 174M 43M 28M S 2.7 2.3 0:01.45 node ...
      const parts = line.split(/\s+/);
      if (parts.length >= 10) {
        const pid = parseInt(parts[0], 10);
        if (Number.isNaN(pid)) continue;
        const user = parts[1];
        const resStr = parts[5]; // e.g. 43M or 3.8M or 800K
        const status = parts[7];
        const cpu = parseFloat(parts[8]) || 0;
        const memPct = parseFloat(parts[9]) || 0;
        const cmd = parts.slice(11).join(' ') || parts[10];

        let resMb = 0;
        if (resStr.endsWith('M')) resMb = parseFloat(resStr);
        else if (resStr.endsWith('K')) resMb = +(parseFloat(resStr) / 1024).toFixed(1);
        else if (resStr.endsWith('G')) resMb = parseFloat(resStr) * 1024;

        processes.push({
          pid,
          user,
          cpu,
          memPct,
          resMb: +resMb.toFixed(1),
          status,
          cmd: cmd.replace(/^\[|\]$/g, '')
        });
      }
    }
  }

  return { summary, processes };
}

async function getAndroidProcesses() {
  const now = Date.now();
  if (cachedProcData && now - lastProcFetch < 3000) {
    return cachedProcData;
  }

  const adbHost = getAdbHost();
  const raw = await execAdb(['-s', adbHost, 'shell', 'top -b -n 1 -m 25']);
  const parsed = parseTopOutput(raw);

  if (parsed && parsed.processes.length > 0) {
    cachedProcData = parsed;
    lastProcFetch = now;
    return parsed;
  }

  // Fallback para desarrollo sin ADB
  const fallback = {
    summary: { totalTasks: 412, runningTasks: 2, swapTotalMb: 1359, swapUsedMb: 486, swapPercent: 36 },
    processes: [
      { pid: 29164, user: 'u0_a217', cpu: 2.7, memPct: 4.3, resMb: 78.3, status: 'S', cmd: 'node server.js (notas)' },
      { pid: 22429, user: 'u0_a217', cpu: 1.5, memPct: 2.3, resMb: 43.1, status: 'S', cmd: 'node localtunnel --port 3050' },
      { pid: 19931, user: 'u0_a217', cpu: 0.8, memPct: 1.2, resMb: 24.5, status: 'S', cmd: 'node server.js (telemetria)' },
      { pid: 1845, user: 'system', cpu: 1.1, memPct: 6.8, resMb: 122.0, status: 'S', cmd: 'system_server' },
      { pid: 2102, user: 'u0_a104', cpu: 0.4, memPct: 5.2, resMb: 94.2, status: 'S', cmd: 'com.android.systemui' },
      { pid: 1412, user: 'system', cpu: 0.2, memPct: 2.1, resMb: 38.0, status: 'S', cmd: 'surfaceflinger' }
    ]
  };

  return fallback;
}

module.exports = {
  getAndroidProcesses
};

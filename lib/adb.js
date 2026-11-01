const { execFile } = require('child_process');
const path = require('path');
const config = require('./config');

const isWindows = process.platform === 'win32';
const scriptAbsolute = path.resolve(__dirname, '..', config.scriptPath || './scripts/screen_control.sh');

let cachedAdbData = null;
let lastAdbFetch = 0;
let manualScreenState = null;

function getAdbHost() {
  return isWindows ? (config.adbHostRemote || '127.0.0.1:5555') : (config.adbHostLocal || '127.0.0.1:5555');
}

function execAsync(cmd, args, timeout = 3500) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => {
      if (err) return resolve({ ok: false, stdout: '', error: err.message });
      resolve({ ok: true, stdout: stdout || '' });
    });
  });
}

function parseAdbTelemetryOutput(raw) {
  if (!raw || !raw.includes('===BATTERY===')) return null;

  const result = {
    battery: null,
    screen: null,
    procStat: null,
    loadavg: null
  };

  const parts = raw.split(/===(BATTERY|POWER|STAT|LOADAVG)===/);
  for (let i = 1; i < parts.length; i += 2) {
    const section = parts[i];
    const body = (parts[i + 1] || '').trim();

    if (section === 'BATTERY' && body) {
      const levelMatch = body.match(/^\s*level:\s*(\d+)/im);
      const tempMatch = body.match(/^\s*temperature:\s*(\d+)/im);
      const voltMatch = body.match(/^\s*voltage:\s*(\d+)/im);
      const acMatch = body.match(/^\s*AC powered:\s*(true|false)/im);
      const usbMatch = body.match(/^\s*USB powered:\s*(true|false)/im);
      const statusMatch = body.match(/^\s*status:\s*(\d+)/im);

      if (levelMatch) {
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 2;
        const statusMap = {
          2: 'Cargando',
          3: 'Descargando',
          4: 'No cargando',
          5: 'Completa'
        };
        const acPowered = acMatch && acMatch[1].toLowerCase() === 'true';
        const usbPowered = usbMatch && usbMatch[1].toLowerCase() === 'true';

        result.battery = {
          level: parseInt(levelMatch[1], 10),
          temperature: tempMatch ? +(parseInt(tempMatch[1], 10) / 10).toFixed(1) : 31.0,
          voltage: voltMatch ? +(parseInt(voltMatch[1], 10) / 1000).toFixed(2) : 4.15,
          status: statusMap[statusCode] || (acPowered || usbPowered ? 'Cargando' : 'En línea'),
          plugged: acPowered ? 'AC / Mini-UPS 5V' : (usbPowered ? 'USB 5V' : 'Batería'),
          source: 'adb_dumpsys'
        };
      }
    }

    if (section === 'POWER' && body) {
      if (/Awake|state=ON/i.test(body)) {
        result.screen = 'ON';
      } else if (/Asleep|Dozing|state=OFF/i.test(body)) {
        result.screen = 'OFF';
      }
    }

    if (section === 'STAT' && body.startsWith('cpu')) {
      result.procStat = body;
    }

    if (section === 'LOADAVG' && body) {
      result.loadavg = body;
    }
  }

  return result;
}

async function fetchAdbTelemetry() {
  const now = Date.now();
  if (cachedAdbData && now - lastAdbFetch < (config.cacheTtlMs || 2000)) {
    return cachedAdbData;
  }

  const adbHost = getAdbHost();
  let res;

  if (!isWindows) {
    res = await execAsync('bash', [scriptAbsolute, 'telemetry', adbHost]);
  } else {
    const shellCmd = "echo '===BATTERY==='; dumpsys battery; echo '===POWER==='; dumpsys power | grep -E 'mWakefulness=|Display Power:'; echo '===STAT==='; head -n 9 /proc/stat; echo '===LOADAVG==='; cat /proc/loadavg";
    res = await execAsync('adb', ['-s', adbHost, 'shell', shellCmd]);
  }

  if (res.ok && res.stdout) {
    const parsed = parseAdbTelemetryOutput(res.stdout);
    if (parsed) {
      cachedAdbData = parsed;
      lastAdbFetch = now;
      if (parsed.screen) manualScreenState = parsed.screen;
      return parsed;
    }
  }

  return cachedAdbData;
}

async function controlScreen(action) {
  const normalized = action === 'on' ? 'on' : 'off';
  const keyevent = normalized === 'on' ? '224' : '223';
  const adbHost = getAdbHost();

  let res;
  if (!isWindows) {
    res = await execAsync('bash', [scriptAbsolute, normalized, adbHost]);
  } else {
    await execAsync('adb', ['connect', adbHost], 2000);
    res = await execAsync('adb', ['-s', adbHost, 'shell', 'input', 'keyevent', keyevent]);
  }

  manualScreenState = normalized === 'on' ? 'ON' : 'OFF';
  if (cachedAdbData) {
    cachedAdbData.screen = manualScreenState;
  }

  return {
    ok: true,
    screen: manualScreenState,
    adbExecuted: res.ok,
    host: adbHost,
    keyevent: `KEYCODE_${normalized === 'on' ? 'WAKEUP (224)' : 'SLEEP (223)'}`
  };
}

function getManualScreenState() {
  return manualScreenState;
}

module.exports = {
  fetchAdbTelemetry,
  controlScreen,
  getManualScreenState,
  getAdbHost
};

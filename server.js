const express = require('express');
const path = require('path');
const config = require('./lib/config');
const { discoverHostInfo } = require('./lib/discovery');
const { fetchAdbTelemetry, controlScreen, getManualScreenState } = require('./lib/adb');
const { getCpuMetrics, getRamMetrics, getUptimeMetrics } = require('./lib/system');
const { getBatteryMetrics } = require('./lib/battery');
const { getPm2Processes } = require('./lib/pm2');
const auth = require('./lib/auth');

const app = express();
const PORT = config.port || 3055;
const MAX_POINTS = config.historyMaxPoints || 20;

app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '2kb' }));

// Ring Buffer en memoria para que la gráfica de línea aparezca poblada desde el primer segundo
const history = [];

function formatTimeLabel(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function seedInitialHistory() {
  const now = Date.now();
  const baseCpu = [14, 18, 16, 22, 19, 25, 21, 17, 23, 20, 26, 22];
  const baseRam = [58, 59, 59, 60, 60, 61, 61, 60, 61, 62, 61, 62];
  for (let i = 0; i < baseCpu.length; i++) {
    const t = new Date(now - (baseCpu.length - i) * 3000);
    history.push({
      time: formatTimeLabel(t),
      cpu: baseCpu[i],
      ram: baseRam[i],
      temp: 31.2
    });
  }
}

seedInitialHistory();

function pushHistoryPoint(cpuPct, ramPct, tempC) {
  const label = formatTimeLabel(new Date());
  const last = history[history.length - 1];
  if (last && last.time === label) {
    last.cpu = cpuPct;
    last.ram = ramPct;
    last.temp = tempC;
    return;
  }
  history.push({
    time: label,
    cpu: cpuPct,
    ram: ramPct,
    temp: tempC
  });
  if (history.length > MAX_POINTS) {
    history.shift();
  }
}

async function buildTelemetryPayload() {
  const [hostInfo, adbData] = await Promise.all([
    discoverHostInfo(),
    fetchAdbTelemetry()
  ]);

  const [cpu, ram, battery, uptime, pm2] = await Promise.all([
    getCpuMetrics(adbData, hostInfo.socName),
    getRamMetrics(),
    getBatteryMetrics(adbData),
    getUptimeMetrics(),
    getPm2Processes()
  ]);

  const screenState = (adbData && adbData.screen) || getManualScreenState() || 'OFF';
  pushHistoryPoint(cpu.usage, ram.percent, battery.temperature);

  return {
    timestamp: Date.now(),
    server: hostInfo,
    cpu,
    ram,
    battery,
    screen: {
      state: screenState,
      label: screenState === 'ON' ? 'Encendida (Awake)' : 'En reposo (Headless)'
    },
    uptime,
    pm2,
    history
  };
}

// ---------------------------------------------------------------------------
// Autenticación (contraseña única, hash scrypt en .env)
// ---------------------------------------------------------------------------
app.get('/api/auth/status', (req, res) => {
  res.json({ configured: auth.isConfigured(), authenticated: auth.isAuthenticated(req) });
});

app.post('/api/auth/login', async (req, res) => {
  if (!auth.isConfigured()) {
    return res.status(403).json({ ok: false, error: 'No hay contraseña configurada en el servidor' });
  }

  const ip = req.ip;
  const lockMs = auth.getLockRemainingMs(ip);
  if (lockMs > 0) {
    return res.status(429).json({
      ok: false,
      error: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(lockMs / 60000)} min`
    });
  }

  const password = req.body && req.body.password;
  const valid = await auth.verifyPassword(password, config.authPasswordHash);
  if (!valid) {
    const left = auth.registerFailure(ip);
    return res.status(401).json({
      ok: false,
      error: left > 0 ? `Contraseña incorrecta (${left} intentos restantes)` : 'Demasiados intentos. Bloqueado 15 min'
    });
  }

  auth.clearFailures(ip);
  auth.setSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (_req, res) => {
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

// Endpoint principal consolidado (1 sola llamada HTTP por ciclo)
app.get(['/api/telemetry', '/api/status'], auth.requireAuthIfConfigured, async (_req, res) => {
  try {
    const payload = await buildTelemetryPayload();
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoint de solo lectura para procesos PM2
app.get('/api/pm2', auth.requireAuthIfConfigured, async (_req, res) => {
  try {
    const processes = await getPm2Processes();
    res.json({ ok: true, processes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoints de control de pantalla vía script ADB
app.post(['/api/screen/on', '/api/screen/wake'], auth.requireAuthStrict, async (_req, res) => {
  try {
    const result = await controlScreen('on');
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post(['/api/screen/off', '/api/screen/sleep'], auth.requireAuthStrict, async (_req, res) => {
  try {
    const result = await controlScreen('off');
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Servir archivos estáticos compilados por Vite en public/
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Endpoint no encontrado' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const rss = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  console.log(`[Termux Telemetry] Servidor activo en http://0.0.0.0:${PORT} (RAM inicial: ${rss} MB)`);
  if (!auth.isConfigured()) {
    console.warn('[Termux Telemetry] ⚠ Sin contraseña: panel en solo lectura y control de pantalla bloqueado.');
    console.warn('[Termux Telemetry]   Ejecuta "npm run set-password" para activar el control de acceso.');
  }
});

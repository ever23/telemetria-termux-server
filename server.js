const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const config = require('./lib/config');
const { discoverHostInfo } = require('./lib/discovery');
const { fetchAdbTelemetry, controlScreen, getManualScreenState } = require('./lib/adb');
const { getCpuMetrics, getRamMetrics, getUptimeMetrics } = require('./lib/system');
const { getBatteryMetrics } = require('./lib/battery');
const { getPm2Processes } = require('./lib/pm2');
const { getStorageMetrics } = require('./lib/storage');
const { getAndroidProcesses } = require('./lib/android-proc');
const { getNetworkTelemetry } = require('./lib/network');
const { getLogLines, clearLog } = require('./lib/logs');
const { getHttpServices } = require('./lib/ports');
const auth = require('./lib/auth');

const app = express();
const PORT = config.port || 3055;
const MAX_POINTS = config.historyMaxPoints || 20;

app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '4kb' }));

// Ring Buffer en memoria para gráfica de telemetría
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
  const baseRam = [48, 49, 49, 50, 50, 51, 51, 50, 51, 52, 51, 50];
  for (let i = 0; i < baseCpu.length; i++) {
    const t = new Date(now - (baseCpu.length - i) * 3000);
    history.push({
      time: formatTimeLabel(t),
      cpu: baseCpu[i],
      ram: baseRam[i],
      temp: 32.5
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

  const [cpu, ram, battery, uptime, pm2, storage] = await Promise.all([
    getCpuMetrics(adbData, hostInfo.socName),
    getRamMetrics(),
    getBatteryMetrics(adbData),
    getUptimeMetrics(),
    getPm2Processes(),
    getStorageMetrics()
  ]);

  let httpServices = [];
  try {
    httpServices = await getHttpServices(pm2, hostInfo);
  } catch (_) {}

  // Extraer los túneles descubiertos y pinguear su estado
  const cfTunnels = httpServices.filter((s) => s.isTunnel);
  const network = await getNetworkTelemetry(hostInfo.tunnelUrl, cfTunnels);

  // Si hostInfo.tunnelUrl no estaba configurado, asociar el primer túnel descubierto
  if ((!hostInfo.tunnelUrl || hostInfo.tunnelUrl === 'N/A') && network.tunnel?.url) {
    hostInfo.tunnelUrl = network.tunnel.url;
  }

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
    storage,
    network,
    uptime,
    pm2,
    httpServices: httpServices || [],
    history
  };
}

// ---------------------------------------------------------------------------
// Autenticación
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

// ---------------------------------------------------------------------------
// Telemetría General
// ---------------------------------------------------------------------------
app.get(['/api/telemetry', '/api/status'], auth.requireAuthIfConfigured, async (_req, res) => {
  try {
    const payload = await buildTelemetryPayload();
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Puertos y Servicios HTTP
// ---------------------------------------------------------------------------
app.get('/api/ports', auth.requireAuthIfConfigured, async (_req, res) => {
  try {
    const hostInfo = await discoverHostInfo();
    const pm2 = await getPm2Processes();
    const services = await getHttpServices(pm2, hostInfo);
    res.json({ ok: true, ip: hostInfo.ip, services });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Procesos Android y ZRAM/Swap
// ---------------------------------------------------------------------------
app.get('/api/android/processes', auth.requireAuthIfConfigured, async (_req, res) => {
  try {
    const data = await getAndroidProcesses();
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Almacenamiento y Red
// ---------------------------------------------------------------------------
app.get('/api/system/storage', auth.requireAuthIfConfigured, async (_req, res) => {
  try {
    const storage = await getStorageMetrics();
    res.json({ ok: true, storage });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/system/network', auth.requireAuthIfConfigured, async (_req, res) => {
  try {
    const hostInfo = await discoverHostInfo();
    const { discoverCloudflareTunnels } = require('./lib/ports');
    const cfTunnels = await discoverCloudflareTunnels();
    const network = await getNetworkTelemetry(hostInfo.tunnelUrl, cfTunnels);
    res.json({ ok: true, network });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/network/ping', auth.requireAuthIfConfigured, async (_req, res) => {
  try {
    const hostInfo = await discoverHostInfo();
    const { discoverCloudflareTunnels } = require('./lib/ports');
    const cfTunnels = await discoverCloudflareTunnels();
    // Forzar chequeo fresco
    const network = await getNetworkTelemetry(hostInfo.tunnelUrl, cfTunnels);
    res.json({ ok: true, network });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/system/tunnel', auth.requireAuthStrict, (req, res) => {
  const url = (req.body && req.body.url ? String(req.body.url) : '').trim().replace(/^https?:\/\//, '');
  const { upsertEnv } = require('./lib/envfile');
  upsertEnv('TUNNEL_URL', url);
  config.tunnelUrl = url;
  res.json({ ok: true, tunnelUrl: url, message: 'URL del túnel guardada en .env' });
});

// ---------------------------------------------------------------------------
// Visor y Rotación de Logs
// ---------------------------------------------------------------------------
app.get('/api/logs/:target', auth.requireAuthIfConfigured, async (req, res) => {
  try {
    const target = req.params.target;
    const content = await getLogLines(target);
    res.json({ ok: true, target, content });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/logs/:target/clear', auth.requireAuthStrict, async (req, res) => {
  try {
    const target = req.params.target;
    const result = await clearLog(target);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Procesos PM2 y Acciones
// ---------------------------------------------------------------------------
app.get('/api/pm2', auth.requireAuthIfConfigured, async (_req, res) => {
  try {
    const processes = await getPm2Processes();
    res.json({ ok: true, processes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/pm2/restart/:id', auth.requireAuthStrict, (req, res) => {
  const idOrName = req.params.id;
  // Sanitizar parámetro para evitar inyección
  if (!/^[a-zA-Z0-9_-]+$/.test(idOrName)) {
    return res.status(400).json({ ok: false, error: 'Identificador no válido' });
  }

  exec(`pm2 restart ${idOrName}`, { timeout: 6000 }, (err) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, message: `Proceso ${idOrName} reiniciado` });
  });
});

// ---------------------------------------------------------------------------
// Control de Pantalla ADB
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Actualización del Servidor desde Git
// ---------------------------------------------------------------------------
app.post('/api/system/update', auth.requireAuthStrict, (_req, res) => {
  const updateScript = path.resolve(__dirname, 'scripts/actualizar.sh');
  res.json({ ok: true, message: 'Actualización iniciada en segundo plano' });

  // Ejecutar actualizar.sh en segundo plano
  setTimeout(() => {
    exec(`bash "${updateScript}" > /dev/null 2>&1 &`);
  }, 500);
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

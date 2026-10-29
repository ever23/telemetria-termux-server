const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./lib/config');
const { discoverHostInfo } = require('./lib/discovery');
const { fetchAdbTelemetry, controlScreen, getManualScreenState } = require('./lib/adb');
const { getCpuMetrics, getRamMetrics, getUptimeMetrics } = require('./lib/system');
const { getBatteryMetrics } = require('./lib/battery');
const { getPm2Processes } = require('./lib/pm2');

const app = express();
const PORT = config.port || 3055;
const MAX_POINTS = config.historyMaxPoints || 20;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json());

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

// Endpoint principal consolidado (1 sola llamada HTTP por ciclo)
app.get(['/api/telemetry', '/api/status'], async (_req, res) => {
  try {
    const payload = await buildTelemetryPayload();
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoint de solo lectura para procesos PM2
app.get('/api/pm2', async (_req, res) => {
  try {
    const processes = await getPm2Processes();
    res.json({ ok: true, processes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoints de control de pantalla vía script ADB
app.post(['/api/screen/on', '/api/screen/wake'], async (_req, res) => {
  try {
    const result = await controlScreen('on');
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post(['/api/screen/off', '/api/screen/sleep'], async (_req, res) => {
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
});

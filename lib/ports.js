const http = require('http');
const { execFile } = require('child_process');
const { getAdbHost } = require('./adb');

let lastCheck = 0;
let cachedServices = [];

function execAdb(args, timeout = 3000) {
  return new Promise((resolve) => {
    execFile('adb', args, { timeout, windowsHide: true }, (err, stdout) => {
      if (err) return resolve('');
      resolve(stdout || '');
    });
  });
}

/**
 * Prueba si un puerto local responde al protocolo HTTP en un tiempo ultra corto (400ms).
 */
function probeHttpPort(port, timeout = 400) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: '127.0.0.1',
        port,
        path: '/',
        timeout
      },
      (res) => {
        res.resume(); // descartar payload
        resolve({ isHttp: true, status: res.statusCode });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ isHttp: false });
    });

    req.on('error', () => {
      resolve({ isHttp: false });
    });
  });
}

/**
 * Extrae los puertos en estado LISTEN (0A) de /proc/net/tcp y tcp6
 */
function parseListeningPorts(raw) {
  const ports = new Set();
  const lines = raw.split('\n');

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 4) {
      // Estado 0A es TCP_LISTEN
      const state = parts[3];
      if (state === '0A') {
        const localAddr = parts[1];
        const portHex = localAddr.split(':')[1];
        if (portHex) {
          const port = parseInt(portHex, 16);
          if (port > 0 && port < 65536) {
            ports.add(port);
          }
        }
      }
    }
  }

  return Array.from(ports);
}

/**
 * Descubre todos los servicios HTTP activos en el dispositivo y sus URLs.
 */
async function getHttpServices(pm2List = [], hostInfo = {}) {
  const now = Date.now();
  if (now - lastCheck < 5000 && cachedServices.length > 0) {
    return cachedServices;
  }

  const lanIp = hostInfo.ip || '127.0.0.1';
  const adbHost = getAdbHost();

  // 1. Obtener puertos en escucha por ADB o lista común
  let candidatePorts = new Set([3055, 3050, 3000, 8080, 5000, 8000, 80]);

  try {
    const rawTcp = await execAdb(['-s', adbHost, 'shell', 'cat /proc/net/tcp /proc/net/tcp6 2>/dev/null']);
    if (rawTcp) {
      const parsed = parseListeningPorts(rawTcp);
      parsed.forEach((p) => candidatePorts.add(p));
    }
  } catch (_) {}

  // Excluir puertos conocidos que NO son HTTP para ahorrar tiempo (ej. SSH 8022, ADB 5555, 5037)
  const nonHttp = [8022, 5555, 5037, 53, 123];
  const testList = Array.from(candidatePorts).filter((p) => !nonHttp.includes(p));

  // 2. Probar en paralelo cuáles responden a HTTP
  const probePromises = testList.map(async (port) => {
    const result = await probeHttpPort(port);
    if (!result.isHttp) return null;

    // Asignar nombre amigable según el puerto o PM2
    let name = `Servicio Web :${port}`;
    let icon = 'globe';

    if (port === 3055) {
      name = 'Telemetría Dashboard';
      icon = 'gauge';
    } else if (port === 3050) {
      name = 'Control de Notas';
      icon = 'notes';
    } else if (port === 3000) {
      name = 'App Web (:3000)';
      icon = 'server';
    } else {
      // Buscar si coincide con el nombre de algún proceso PM2
      const matchedPm2 = Array.isArray(pm2List)
        ? pm2List.find((p) => p.name && p.name.includes(String(port)))
        : null;
      if (matchedPm2) {
        name = matchedPm2.name;
      }
    }

    return {
      port,
      name,
      icon,
      isTunnel: false,
      url: `http://${lanIp}:${port}`
    };
  });

  const discovered = (await Promise.all(probePromises)).filter(Boolean);

  // Ordenar puertos numéricamente (3050, 3055, etc.)
  discovered.sort((a, b) => a.port - b.port);

  // 3. Si hay túnel Cloudflare público activo, añadirlo a la lista
  if (hostInfo.tunnelUrl) {
    discovered.unshift({
      port: 443,
      name: 'Túnel Cloudflare (Público)',
      icon: 'shield',
      isTunnel: true,
      url: hostInfo.tunnelUrl
    });
  }

  cachedServices = discovered;
  lastCheck = now;
  return discovered;
}

module.exports = {
  getHttpServices
};

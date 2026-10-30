const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const auth = require('./auth');

const isWin = process.platform === 'win32';

// En Termux os.homedir() a veces devuelve /data, por lo que process.env.HOME tiene prioridad
const homeDir = process.env.HOME || '/data/data/com.termux/files/home' || os.homedir();

function execCmd(cmd, timeout = 3500) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, windowsHide: true }, (err, stdout) => {
      if (err) return resolve('');
      resolve(stdout || '');
    });
  });
}

function extractJsonArray(str) {
  if (!str) return null;
  const start = str.indexOf('[');
  const end = str.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(str.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) {}
  }
  return null;
}

/**
 * Autodetecta dinámicamente todas las fuentes de log disponibles en el dispositivo:
 * 1. Procesos PM2 (activos o configurados).
 * 2. Archivos .log en ~/.pm2/logs/, $HOME, ~/logs/ y directorio del proyecto.
 * 3. Logcat del sistema Android.
 */
async function listAvailableLogs() {
  const sources = [];
  const seenIds = new Set();
  const seenPaths = new Set();

  function addSource(src) {
    if (!src || !src.id || seenIds.has(src.id)) return;
    seenIds.add(src.id);
    if (src.path) seenPaths.add(src.path);
    sources.push(src);
  }

  // Posibles directorios de HOME
  const candidateHomes = [
    process.env.HOME,
    '/data/data/com.termux/files/home',
    os.homedir(),
    path.resolve(__dirname, '..')
  ].filter(Boolean);

  // 1. Autodetección de procesos PM2 mediante `pm2 jlist`
  try {
    const pm2Raw = await execCmd('pm2 jlist');
    const procs = extractJsonArray(pm2Raw);
    if (procs && procs.length > 0) {
      for (const p of procs) {
        const name = p.name || `app-${p.pm_id}`;
        const outLog = p.pm2_env?.pm_out_log_path || path.join(homeDir, '.pm2', 'logs', `${name}-out.log`);
        const errLog = p.pm2_env?.pm_err_log_path || path.join(homeDir, '.pm2', 'logs', `${name}-error.log`);

        addSource({
          id: `pm2:${name}:out`,
          name: `${name} (Salida / Out)`,
          group: 'Procesos PM2',
          path: outLog,
          type: 'file',
          pm2Name: name
        });

        addSource({
          id: `pm2:${name}:err`,
          name: `${name} (Errores / Err)`,
          group: 'Procesos PM2',
          path: errLog,
          type: 'file',
          pm2Name: name
        });
      }
    }
  } catch (_) {}

  // 2. Escaneo de archivos en directorios de logs de PM2 (~/.pm2/logs/*.log)
  for (const h of candidateHomes) {
    const pm2LogsDir = path.join(h, '.pm2', 'logs');
    if (fs.existsSync(pm2LogsDir)) {
      try {
        const files = fs.readdirSync(pm2LogsDir);
        for (const file of files) {
          if (file.endsWith('.log')) {
            const fullPath = path.join(pm2LogsDir, file);
            if (!seenPaths.has(fullPath)) {
              addSource({
                id: `file:${fullPath}`,
                name: file.replace(/-out\.log$/, ' (out)').replace(/-error\.log$/, ' (err)'),
                group: 'Procesos PM2',
                path: fullPath,
                type: 'file'
              });
            }
          }
        }
      } catch (_) {}
    }
  }

  // 3. Archivos .log en directorios de HOME y del proyecto
  for (const h of candidateHomes) {
    if (fs.existsSync(h)) {
      try {
        const files = fs.readdirSync(h);
        for (const f of files) {
          if (f.endsWith('.log')) {
            const fullPath = path.join(h, f);
            if (!seenPaths.has(fullPath)) {
              addSource({
                id: `file:${fullPath}`,
                name: f,
                group: 'Archivos de Registro (.log)',
                path: fullPath,
                type: 'file'
              });
            }
          }
        }
      } catch (_) {}
    }
  }

  // 4. Android Logcat (Sistema Operativo en vivo)
  if (!isWin) {
    addSource({
      id: 'android:logcat',
      name: 'Android Logcat (Sistema en vivo)',
      group: 'Sistema Android',
      type: 'command',
      cmd: 'logcat',
      args: ['-v', 'time', '-T', '1'],
      historyCmd: 'logcat -v time -d -t 60'
    });
    addSource({
      id: 'android:logcat-err',
      name: 'Android Logcat (Solo Errores *:E)',
      group: 'Sistema Android',
      type: 'command',
      cmd: 'logcat',
      args: ['-v', 'time', '*:E', '-T', '1'],
      historyCmd: 'logcat -v time *:E -d -t 60'
    });
  }

  // 5. Fallback para desarrollo local en PC o si aún no hay logs creados
  if (sources.length === 0) {
    addSource({
      id: 'mock:telemetry',
      name: 'termux-telemetry (Servidor)',
      group: 'Servidor Telemetría',
      type: 'mock'
    });
    addSource({
      id: 'mock:system',
      name: 'system.log (Registro del Sistema)',
      group: 'Servidor Telemetría',
      type: 'mock'
    });
  }

  return sources;
}

/**
 * Obtiene las líneas iniciales de un log para mostrar historial inmediato
 */
async function getLogLines(targetId, maxLines = 60) {
  const sources = await listAvailableLogs();
  const source = sources.find((s) => s.id === targetId) || sources[0];

  if (!source) {
    return 'No hay fuentes de log disponibles en este momento.';
  }

  if (source.type === 'mock') {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return [
      `${now} [INFO] [System] Servidor de telemetría activo en http://0.0.0.0:3055`,
      `${now} [INFO] [PM2] Monitor de procesos conectado`,
      `${now} [INFO] [Network] Escucha en todas las interfaces de red`,
      `${now} [INFO] [Stream] Esperando nuevos eventos en tiempo real...`
    ].join('\n');
  }

  if (source.type === 'command') {
    const out = await execCmd(source.historyCmd, 4000);
    return out || 'Sin registros recientes en el buffer de logcat.';
  }

  if (source.type === 'file' && source.path) {
    if (!fs.existsSync(source.path)) {
      return `El archivo de registro aún no tiene datos (${path.basename(source.path)}).\nEsperando primeras líneas de salida...`;
    }

    if (!isWin) {
      const out = await execCmd(`tail -n ${maxLines} "${source.path}"`);
      return out || 'El archivo está vacío actualmente.';
    }

    try {
      const content = fs.readFileSync(source.path, 'utf8');
      const lines = content.split('\n');
      return lines.slice(-maxLines).join('\n') || 'El archivo está vacío actualmente.';
    } catch (err) {
      return `Error leyendo archivo: ${err.message}`;
    }
  }

  return 'Fuente no válida.';
}

/**
 * Vacía el contenido de un log
 */
async function clearLog(targetId) {
  const sources = await listAvailableLogs();
  const source = sources.find((s) => s.id === targetId);

  if (!source) {
    return { ok: false, error: 'Fuente no encontrada' };
  }

  if (source.pm2Name) {
    await execCmd(`pm2 flush ${source.pm2Name}`);
    return { ok: true, message: `Logs de PM2 ${source.pm2Name} vaciados exitosamente` };
  }

  if (source.id.startsWith('android:logcat')) {
    await execCmd('logcat -c');
    return { ok: true, message: 'Buffer de Android logcat vaciado' };
  }

  if (source.path && fs.existsSync(source.path)) {
    try {
      fs.truncateSync(source.path, 0);
      return { ok: true, message: `Archivo ${path.basename(source.path)} vaciado exitosamente` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return { ok: true, message: 'Buffer de pantalla limpiado' };
}

/**
 * Configura el servidor WebSocket para streaming en tiempo real de logs
 */
function setupLogsWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/logs' });

  wss.on('connection', async (ws, req) => {
    // 1. Verificación opcional de autenticación si está configurada
    if (auth.isConfigured()) {
      const cookieHeader = req.headers.cookie || '';
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [k, ...v] = c.trim().split('=');
          return [k, decodeURIComponent((v || []).join('='))];
        })
      );
      const token = cookies['tt_session'];
      if (!auth.isValidSessionToken(token)) {
        ws.send(JSON.stringify({ type: 'error', message: 'No autenticado. Inicia sesión en el panel.' }));
        ws.close(4401, 'Unauthorized');
        return;
      }
    }

    let activeStream = null;
    let mockInterval = null;

    function stopCurrentStream() {
      if (activeStream) {
        try {
          activeStream.kill('SIGTERM');
        } catch (_) {}
        activeStream = null;
      }
      if (mockInterval) {
        clearInterval(mockInterval);
        mockInterval = null;
      }
    }

    async function startWatching(targetId) {
      stopCurrentStream();

      const sources = await listAvailableLogs();
      const source = sources.find((s) => s.id === targetId) || sources[0];

      if (!source) {
        ws.send(JSON.stringify({ type: 'error', message: 'No se encontró la fuente de log.' }));
        return;
      }

      // 1. Enviar el historial de líneas iniciales
      const history = await getLogLines(source.id, 80);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'history',
            target: source.id,
            sourceName: source.name,
            text: history
          })
        );
      }

      // 2. Stream en vivo
      if (source.type === 'mock') {
        mockInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const now = new Date().toISOString().slice(11, 19);
            const ramRss = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
            ws.send(
              JSON.stringify({
                type: 'line',
                target: source.id,
                text: `${now} [INFO] Telemetría en vivo • RAM RSS: ${ramRss} MB • Heartbeat OK`
              })
            );
          }
        }, 3000);
        return;
      }

      if (source.type === 'command') {
        try {
          activeStream = spawn(source.cmd, source.args, { windowsHide: true });
        } catch (err) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'line', text: `[Error iniciando stream logcat]: ${err.message}` }));
          }
          return;
        }
      } else if (source.type === 'file' && source.path) {
        // Asegurar que el archivo exista para que tail no falle
        try {
          if (!fs.existsSync(source.path)) {
            const dir = path.dirname(source.path);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(source.path, '', 'utf8');
          }
        } catch (_) {}

        if (!isWin) {
          activeStream = spawn('tail', ['-n', '0', '-F', source.path], { windowsHide: true });
        } else {
          activeStream = spawn('powershell.exe', ['-NoProfile', '-Command', `Get-Content -Path "${source.path}" -Wait -Tail 0`], { windowsHide: true });
        }
      }

      if (activeStream) {
        let buffer = '';

        activeStream.stdout.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.trim().length > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'line', target: source.id, text: line }));
            }
          }
        });

        activeStream.stderr.on('data', (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'line', target: source.id, text: chunk.toString('utf8') }));
          }
        });

        activeStream.on('error', (err) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'line', text: `[Stream Error]: ${err.message}` }));
          }
        });
      }
    }

    // Enviar inmediatamente la lista de fuentes autodetectadas
    const initialSources = await listAvailableLogs();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'sources', sources: initialSources }));
    }

    // Comenzar viendo el primer log disponible
    if (initialSources.length > 0) {
      startWatching(initialSources[0].id);
    }

    // Escuchar mensajes del cliente
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.action === 'watch' && msg.target) {
          startWatching(msg.target);
        } else if (msg.action === 'list') {
          const refreshed = await listAvailableLogs();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'sources', sources: refreshed }));
          }
        } else if (msg.action === 'clear' && msg.target) {
          const res = await clearLog(msg.target);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'cleared', result: res }));
          }
          startWatching(msg.target);
        }
      } catch (_) {}
    });

    // Keepalive ping cada 20 segundos para mantener la conexión viva en Cloudflare Tunnel
    const pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 20000);

    ws.on('close', () => {
      clearInterval(pingTimer);
      stopCurrentStream();
    });

    ws.on('error', () => {
      clearInterval(pingTimer);
      stopCurrentStream();
    });
  });

  return wss;
}

module.exports = {
  listAvailableLogs,
  getLogLines,
  clearLog,
  setupLogsWebSocket
};

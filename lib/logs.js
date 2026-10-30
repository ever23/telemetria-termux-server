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
 * Lee de forma ultra-rápida y confiable las últimas líneas de un archivo sin depender de comandos externos
 */
function readLastLinesSync(filePath, maxLines = 80) {
  try {
    if (!fs.existsSync(filePath)) {
      return `[Archivo aún no creado en disco: ${path.basename(filePath)}]`;
    }
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return `[Archivo de registro sin datos previos (0 bytes): ${path.basename(filePath)} • Esperando eventos en vivo...]`;
    }

    // Leemos hasta los últimos 256 KB para rendimiento óptimo
    const bytesToRead = Math.min(stat.size, 256 * 1024);
    const buf = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, bytesToRead, stat.size - bytesToRead);
    fs.closeSync(fd);

    const text = buf.toString('utf8');
    const allLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (allLines.length === 0) {
      return `[Archivo sin líneas legibles: ${path.basename(filePath)}]`;
    }
    return allLines.slice(-maxLines).join('\n');
  } catch (err) {
    return `[Error leyendo ${path.basename(filePath)}]: ${err.message}`;
  }
}

/**
 * Obtiene las líneas iniciales de un log para mostrar historial inmediato
 */
async function getLogLines(targetId, maxLines = 80) {
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
    const logcatBin = fs.existsSync('/system/bin/logcat') ? '/system/bin/logcat' : 'logcat';
    const cmd = `${logcatBin} ${source.id.includes('err') ? '-v time *:E -d -t 60' : '-v time -d -t 60'}`;
    const out = await execCmd(cmd, 4000);
    return out || '[Sin registros recientes en el buffer de logcat. Esperando nuevos eventos del sistema...]';
  }

  if (source.type === 'file' && source.path) {
    return readLastLinesSync(source.path, maxLines);
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
    if (auth.isConfigured() && !auth.isAuthenticated(req)) {
      ws.send(JSON.stringify({ type: 'error', message: 'No autenticado. Inicia sesión en el panel.' }));
      ws.close(4401, 'Unauthorized');
      return;
    }

    let activeStream = null;
    let mockInterval = null;
    let fileWatchInterval = null;

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
      if (fileWatchInterval) {
        clearInterval(fileWatchInterval);
        fileWatchInterval = null;
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

      // 1. Enviar las líneas iniciales (historial existente)
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
          const logcatBin = fs.existsSync('/system/bin/logcat') ? '/system/bin/logcat' : 'logcat';
          activeStream = spawn(logcatBin, source.args, { windowsHide: true });
        } catch (err) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'line', text: `[Error iniciando stream logcat]: ${err.message}` }));
          }
          return;
        }

        let buffer = '';
        activeStream.stdout.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split(/\r?\n/);
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
        return;
      }

      // 3. Seguimiento de archivos (.log y procesos PM2) 100% nativo en Node.js
      if (source.type === 'file' && source.path) {
        let currentOffset = 0;
        try {
          if (fs.existsSync(source.path)) {
            currentOffset = fs.statSync(source.path).size;
          }
        } catch (_) {}

        let reading = false;
        fileWatchInterval = setInterval(() => {
          if (reading || ws.readyState !== WebSocket.OPEN) return;
          reading = true;

          try {
            if (!fs.existsSync(source.path)) {
              reading = false;
              return;
            }
            const stat = fs.statSync(source.path);
            if (stat.size < currentOffset) {
              // El archivo fue vaciado o rotado (truncate)
              currentOffset = 0;
            }
            if (stat.size > currentOffset) {
              const bytesToAdd = stat.size - currentOffset;
              const readLength = Math.min(bytesToAdd, 256 * 1024);
              const readPos = stat.size - readLength;
              const buf = Buffer.alloc(readLength);
              const fd = fs.openSync(source.path, 'r');
              fs.readSync(fd, buf, 0, readLength, readPos);
              fs.closeSync(fd);
              currentOffset = stat.size;

              const text = buf.toString('utf8');
              const newLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
              for (const line of newLines) {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'line', target: source.id, text: line }));
                }
              }
            }
          } catch (_) {
          } finally {
            reading = false;
          }
        }, 350);
      }
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

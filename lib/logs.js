const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const auth = require('./auth');

const isWin = process.platform === 'win32';
const homeDir = os.homedir();

function execCmd(cmd, timeout = 3000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return resolve('');
      resolve(stdout || '');
    });
  });
}

/**
 * Autodetecta dinámicamente todas las fuentes de log disponibles en el dispositivo:
 * 1. Todos los procesos PM2 (out y err de cualquier app que esté corriendo).
 * 2. Archivos .log en el directorio HOME y del proyecto.
 * 3. Logcat del sistema Android.
 */
async function listAvailableLogs() {
  const sources = [];
  const seenPaths = new Set();

  // 1. Autodetección de procesos PM2 mediante `pm2 jlist`
  try {
    const pm2Raw = await execCmd('pm2 jlist');
    if (pm2Raw && pm2Raw.trim().startsWith('[')) {
      const procs = JSON.parse(pm2Raw.trim());
      for (const p of procs) {
        const name = p.name || `app-${p.pm_id}`;
        const outLog = p.pm2_env?.pm_out_log_path;
        const errLog = p.pm2_env?.pm_err_log_path;

        if (outLog && fs.existsSync(outLog)) {
          seenPaths.add(outLog);
          sources.push({
            id: `pm2:${name}:out`,
            name: `${name} (Salida / Out)`,
            group: 'Procesos PM2',
            path: outLog,
            type: 'file',
            pm2Name: name
          });
        }
        if (errLog && fs.existsSync(errLog)) {
          seenPaths.add(errLog);
          sources.push({
            id: `pm2:${name}:err`,
            name: `${name} (Errores / Err)`,
            group: 'Procesos PM2',
            path: errLog,
            type: 'file',
            pm2Name: name
          });
        }
      }
    }
  } catch (_) {}

  // Escaneo de archivos en ~/.pm2/logs/*.log (por si hay logs huérfanos o PM2 en standalone)
  const pm2LogsDir = path.join(homeDir, '.pm2', 'logs');
  if (fs.existsSync(pm2LogsDir)) {
    try {
      const files = fs.readdirSync(pm2LogsDir);
      for (const file of files) {
        if (file.endsWith('.log')) {
          const fullPath = path.join(pm2LogsDir, file);
          if (!seenPaths.has(fullPath)) {
            seenPaths.add(fullPath);
            sources.push({
              id: `file:${fullPath}`,
              name: `PM2 • ${file}`,
              group: 'Procesos PM2',
              path: fullPath,
              type: 'file'
            });
          }
        }
      }
    } catch (_) {}
  }

  // 2. Archivos .log en el HOME de Termux / Usuario (~/*.log)
  try {
    const homeFiles = fs.readdirSync(homeDir);
    for (const f of homeFiles) {
      if (f.endsWith('.log')) {
        const fullPath = path.join(homeDir, f);
        if (!seenPaths.has(fullPath)) {
          seenPaths.add(fullPath);
          sources.push({
            id: `file:${fullPath}`,
            name: f,
            group: 'Archivos de Registro (Home)',
            path: fullPath,
            type: 'file'
          });
        }
      }
    }
  } catch (_) {}

  // 3. Archivos .log en el directorio del proyecto
  try {
    const projDir = path.resolve(__dirname, '..');
    const projFiles = fs.readdirSync(projDir);
    for (const f of projFiles) {
      if (f.endsWith('.log')) {
        const fullPath = path.join(projDir, f);
        if (!seenPaths.has(fullPath)) {
          seenPaths.add(fullPath);
          sources.push({
            id: `file:${fullPath}`,
            name: `${f} (telemetria)`,
            group: 'Archivos de Registro (Proyecto)',
            path: fullPath,
            type: 'file'
          });
        }
      }
    }
  } catch (_) {}

  // 4. Android Logcat (Sistema Operativo en vivo)
  if (!isWin) {
    sources.push({
      id: 'android:logcat',
      name: 'Android Logcat (Sistema en vivo)',
      group: 'Sistema Android',
      type: 'command',
      cmd: 'logcat',
      args: ['-v', 'time', '-T', '1'],
      historyCmd: 'logcat -v time -d -t 60'
    });
    sources.push({
      id: 'android:logcat-err',
      name: 'Android Logcat (Solo Errores *:E)',
      group: 'Sistema Android',
      type: 'command',
      cmd: 'logcat',
      args: ['-v', 'time', '*:E', '-T', '1'],
      historyCmd: 'logcat -v time *:E -d -t 60'
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
    return 'No hay fuentes de log detectadas en el sistema.';
  }

  if (source.type === 'command') {
    const out = await execCmd(source.historyCmd, 4000);
    return out || 'Sin registros de logcat disponibles.';
  }

  if (source.type === 'file' && source.path) {
    if (!fs.existsSync(source.path)) {
      return `El archivo de log no existe aún (${path.basename(source.path)})`;
    }

    if (!isWin) {
      const out = await execCmd(`tail -n ${maxLines} "${source.path}"`);
      return out || 'Sin registros.';
    }

    try {
      const content = fs.readFileSync(source.path, 'utf8');
      const lines = content.split('\n');
      return lines.slice(-maxLines).join('\n') || 'Sin registros.';
    } catch (err) {
      return `Error leyendo archivo: ${err.message}`;
    }
  }

  return 'Fuente de log no válida.';
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

  return { ok: false, error: 'No se pudo vaciar la fuente seleccionada' };
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
          return [k, decodeURIComponent(v.join('='))];
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
    let currentTarget = null;

    function stopCurrentStream() {
      if (activeStream) {
        try {
          activeStream.kill('SIGTERM');
        } catch (_) {}
        activeStream = null;
      }
    }

    async function startWatching(targetId) {
      stopCurrentStream();
      currentTarget = targetId;

      const sources = await listAvailableLogs();
      const source = sources.find((s) => s.id === targetId) || sources[0];

      if (!source) {
        ws.send(JSON.stringify({ type: 'error', message: 'No se encontró la fuente de log.' }));
        return;
      }

      // Enviar historial inicial de líneas
      const history = await getLogLines(source.id, 75);
      ws.send(
        JSON.stringify({
          type: 'history',
          target: source.id,
          sourceName: source.name,
          text: history
        })
      );

      // Iniciar proceso de streaming en vivo con tail -F o comando nativo
      if (source.type === 'command') {
        try {
          activeStream = spawn(source.cmd, source.args, { windowsHide: true });
        } catch (err) {
          ws.send(JSON.stringify({ type: 'line', text: `[Error iniciando stream]: ${err.message}` }));
          return;
        }
      } else if (source.type === 'file' && source.path) {
        if (!fs.existsSync(source.path)) {
          ws.send(JSON.stringify({ type: 'line', text: `[Esperando creación del archivo ${path.basename(source.path)}...]` }));
        }

        if (!isWin) {
          // Linux / Termux: tail -n 0 -F sigue el archivo incluso si rota o se vacía
          activeStream = spawn('tail', ['-n', '0', '-F', source.path], { windowsHide: true });
        } else {
          // En Windows usamos PowerShell Get-Content -Wait
          activeStream = spawn('powershell.exe', ['-NoProfile', '-Command', `Get-Content -Path "${source.path}" -Wait -Tail 0`], { windowsHide: true });
        }
      }

      if (activeStream) {
        let buffer = '';

        activeStream.stdout.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop(); // guardar fragmento incompleto

          for (const line of lines) {
            if (line.trim().length > 0) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'line', target: source.id, text: line }));
              }
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
            ws.send(JSON.stringify({ type: 'line', target: source.id, text: `[Stream Error]: ${err.message}` }));
          }
        });
      }
    }

    // Enviar la lista inicial de fuentes autodetectadas
    const initialSources = await listAvailableLogs();
    ws.send(JSON.stringify({ type: 'sources', sources: initialSources }));

    // Si hay fuentes, comenzar a ver la primera por defecto
    if (initialSources.length > 0) {
      startWatching(initialSources[0].id);
    }

    // Escuchar mensajes del cliente (cambio de log, flush, list)
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.action === 'watch' && msg.target) {
          startWatching(msg.target);
        } else if (msg.action === 'list') {
          const refreshed = await listAvailableLogs();
          ws.send(JSON.stringify({ type: 'sources', sources: refreshed }));
        } else if (msg.action === 'clear' && msg.target) {
          const res = await clearLog(msg.target);
          ws.send(JSON.stringify({ type: 'cleared', result: res }));
          startWatching(msg.target);
        }
      } catch (_) {}
    });

    // Keepalive ping cada 25 segundos para Cloudflare Tunnel / Proxies
    const pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 25000);

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

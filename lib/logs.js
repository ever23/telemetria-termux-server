const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();

const LOG_FILES = {
  backup: path.join(homeDir, 'backup.log'),
  tunnel: path.join(homeDir, 'vigilante_tunel.log'),
  tunnel_alt: path.join(homeDir, 'tunnel.log')
};

function execCmd(cmd, timeout = 3000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return resolve(stderr || err.message || 'Error al leer log');
      resolve(stdout || 'Sin contenido registrado');
    });
  });
}

async function getLogLines(target) {
  if (target === 'pm2-notas') {
    return await execCmd('pm2 logs notas --lines 45 --nostream');
  }
  if (target === 'pm2-telemetry') {
    return await execCmd('pm2 logs termux-telemetry --lines 45 --nostream');
  }

  const filePath = LOG_FILES[target];
  if (!filePath) {
    return 'Archivo de log no configurado';
  }

  if (!fs.existsSync(filePath)) {
    // Si es tunnel y existe tunnel_alt
    if (target === 'tunnel' && fs.existsSync(LOG_FILES.tunnel_alt)) {
      return await execCmd(`tail -n 45 "${LOG_FILES.tunnel_alt}"`);
    }
    return `El archivo de log no existe aún (${path.basename(filePath)})`;
  }

  return await execCmd(`tail -n 45 "${filePath}"`);
}

async function clearLog(target) {
  if (target === 'pm2-notas') {
    await execCmd('pm2 flush notas');
    return { ok: true, message: 'Logs de PM2 notas vaciados' };
  }
  if (target === 'pm2-telemetry') {
    await execCmd('pm2 flush termux-telemetry');
    return { ok: true, message: 'Logs de PM2 telemetría vaciados' };
  }

  const filePath = LOG_FILES[target];
  if (!filePath || !fs.existsSync(filePath)) {
    return { ok: false, error: 'Archivo no encontrado' };
  }

  try {
    fs.truncateSync(filePath, 0);
    return { ok: true, message: `Log ${path.basename(filePath)} vaciado exitosamente` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  getLogLines,
  clearLog
};

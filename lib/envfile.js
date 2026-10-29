const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '..', '.env');

/**
 * Inserta o reemplaza una variable en el archivo .env (lo crea si no existe)
 * y restringe sus permisos a solo el usuario actual (chmod 600) en Linux/Termux.
 */
function upsertEnv(key, value) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const line = `${key}=${value}`;
  const regex = new RegExp(`^\\s*#?\\s*${key}=.*$`, 'm');

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    if (content && !content.endsWith('\n')) content += '\n';
    content += `${line}\n`;
  }

  fs.writeFileSync(ENV_PATH, content, 'utf8');
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(ENV_PATH, 0o600);
    } catch (_) {}
  }
  process.env[key] = value;
}

module.exports = { upsertEnv, ENV_PATH };

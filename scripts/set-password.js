#!/usr/bin/env node
/**
 * Define o cambia la contraseña de acceso al panel.
 * Guarda únicamente el hash scrypt en .env (AUTH_PASSWORD_HASH), nunca la contraseña en texto plano.
 * Uso: npm run set-password
 */
const readline = require('readline');
const { hashPassword } = require('../lib/auth');
const { upsertEnv, ENV_PATH } = require('../lib/envfile');

const MIN_LENGTH = 8;

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (str) => {
      if (!muted) return rl.output.write(str);
      if (str.includes('\n') || str.includes('\r')) return rl.output.write('\n');
      rl.output.write('*');
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

(async () => {
  const pass1 = await askHidden('Nueva contraseña del panel: ');
  if (pass1.length < MIN_LENGTH) {
    console.error(`\n✖ La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
    process.exit(1);
  }

  const pass2 = await askHidden('Repite la contraseña: ');
  if (pass1 !== pass2) {
    console.error('\n✖ Las contraseñas no coinciden.');
    process.exit(1);
  }

  const hash = await hashPassword(pass1);
  upsertEnv('AUTH_PASSWORD_HASH', hash);

  console.log(`\n✔ Hash guardado en ${ENV_PATH}`);
  console.log('  Las sesiones abiertas anteriormente quedaron invalidadas.');
  console.log('  Reinicia el panel para aplicar el cambio:  pm2 restart termux-telemetry');
  process.exit(0);
})();

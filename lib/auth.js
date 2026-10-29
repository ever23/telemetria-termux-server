const crypto = require('crypto');
const config = require('./config');
const { upsertEnv } = require('./envfile');

const COOKIE_NAME = 'tt_session';
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const KEY_LEN = 64;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

// Secreto para firmar cookies: se genera una sola vez y se persiste en .env
let sessionSecret = config.sessionSecret;
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  try {
    upsertEnv('SESSION_SECRET', sessionSecret);
  } catch (_) {
    // Si no se puede escribir .env, las sesiones solo durarán hasta el próximo reinicio
  }
}

const attempts = new Map(); // ip -> { count, lockedUntil }

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LEN, SCRYPT_PARAMS, (err, key) => {
      if (err) return reject(err);
      resolve(key);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  if (!stored || typeof password !== 'string') return false;
  const [algo, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function isConfigured() {
  return Boolean(config.authPasswordHash);
}

// Huella del hash actual: al cambiar la contraseña, todas las sesiones previas se invalidan
function passwordFingerprint() {
  return crypto.createHash('sha256').update(config.authPasswordHash || '').digest('hex').slice(0, 16);
}

function sign(data) {
  return crypto.createHmac('sha256', sessionSecret).update(data).digest('base64url');
}

function createSessionToken() {
  const exp = Date.now() + config.sessionDays * 24 * 60 * 60 * 1000;
  const payload = `${exp}.${passwordFingerprint()}`;
  return `${payload}.${sign(payload)}`;
}

function isValidSessionToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [exp, fp, sig] = parts;
  const expectedSig = Buffer.from(sign(`${exp}.${fp}`));
  const givenSig = Buffer.from(sig);
  if (expectedSig.length !== givenSig.length || !crypto.timingSafeEqual(expectedSig, givenSig)) {
    return false;
  }
  return Number(exp) > Date.now() && fp === passwordFingerprint();
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return out;
}

function isLocalRequest(req) {
  if (!req) return false;
  const rawIp = (req.socket && req.socket.remoteAddress) || req.ip || '';
  const isLoopback =
    rawIp === '127.0.0.1' ||
    rawIp === '::1' ||
    rawIp === '::ffff:127.0.0.1' ||
    rawIp === 'localhost';

  // Si trae encabezados de proxy inverso o tunel publico, no es peticion puramente local
  const hasForwarded = Boolean(req.headers && (req.headers['x-forwarded-for'] || req.headers['x-forwarded-host']));
  return isLoopback && !hasForwarded;
}

function isAuthenticated(req) {
  if (isLocalRequest(req)) return true;
  if (!isConfigured()) return false;
  return isValidSessionToken(parseCookies(req.headers.cookie)[COOKIE_NAME]);
}

function setSessionCookie(res) {
  const maxAge = config.sessionDays * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${createSessionToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

// ---- Bloqueo por fuerza bruta ----
function getLockRemainingMs(ip) {
  const entry = attempts.get(ip);
  if (!entry || !entry.lockedUntil) return 0;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) {
    attempts.delete(ip);
    return 0;
  }
  return remaining;
}

function registerFailure(ip) {
  const entry = attempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
  }
  attempts.set(ip, entry);
  return Math.max(0, MAX_ATTEMPTS - entry.count);
}

function clearFailures(ip) {
  attempts.delete(ip);
}

// ---- Middlewares ----

/** Exige sesión si hay contraseña configurada; si no la hay, deja pasar (modo solo lectura). */
function requireAuthIfConfigured(req, res, next) {
  if (!isConfigured() || isAuthenticated(req)) return next();
  res.status(401).json({ ok: false, error: 'No autenticado' });
}

/** Exige sesión siempre. Sin contraseña configurada, la acción queda bloqueada. */
function requireAuthStrict(req, res, next) {
  if (!isConfigured()) {
    return res.status(403).json({
      ok: false,
      error: 'Acción bloqueada: define una contraseña con "npm run set-password"'
    });
  }
  if (isAuthenticated(req)) return next();
  res.status(401).json({ ok: false, error: 'No autenticado' });
}

module.exports = {
  isLocalRequest,
  hashPassword,
  verifyPassword,
  isConfigured,
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
  getLockRemainingMs,
  registerFailure,
  clearFailures,
  requireAuthIfConfigured,
  requireAuthStrict
};

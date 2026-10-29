const { exec } = require('child_process');
const os = require('os');
const config = require('./config');

let cachedHostInfo = null;

function execCmd(cmd, timeout = 2000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve('');
      resolve(stdout.trim());
    });
  });
}

function detectLocalIp() {
  if (config.serverIp) return config.serverIp;
  const nets = os.networkInterfaces();
  // Priorizar wlan0 (Wi-Fi en Android/Termux) y luego cualquier IPv4 LAN
  const preferred = ['wlan0', 'eth0', 'Wi-Fi', 'Ethernet'];
  for (const name of preferred) {
    const list = nets[name];
    if (list) {
      const match = list.find((n) => (n.family === 'IPv4' || n.family === 4) && !n.internal);
      if (match) return match.address;
    }
  }
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function detectCurrentUser() {
  if (config.termuxUser) return config.termuxUser;
  try {
    return os.userInfo().username || process.env.USER || 'termux';
  } catch (_) {
    return process.env.USER || 'termux';
  }
}

async function discoverHostInfo() {
  if (cachedHostInfo) return cachedHostInfo;

  const isWin = process.platform === 'win32';
  const ip = detectLocalIp();
  const termuxUser = detectCurrentUser();

  let deviceName = config.deviceName || os.hostname();
  let socName = config.socName || (os.cpus()?.[0]?.model || 'ARM64 SoC').trim();
  let osName = config.osName || `${os.type()} ${os.release()}`;
  let tunnelUrl = config.tunnelUrl || '';

  if (!isWin) {
    // En Android / Termux getprop funciona directamente sin root
    const [model, brand, socModel, board, androidVer, lowRam, psTunnel] = await Promise.all([
      execCmd('getprop ro.product.model'),
      execCmd('getprop ro.product.brand'),
      execCmd('getprop ro.soc.model'),
      execCmd('getprop ro.board.platform'),
      execCmd('getprop ro.build.version.release'),
      execCmd('getprop ro.config.low_ram'),
      execCmd("ps -ef 2>/dev/null | grep -E 'lt |localtunnel' | grep -v grep; crontab -l 2>/dev/null | grep -E 'lt |localtunnel'")
    ]);

    if (!config.deviceName && model) {
      const cleanBrand = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : '';
      deviceName = model.toLowerCase().startsWith(cleanBrand.toLowerCase())
        ? model
        : `${cleanBrand} ${model}`.trim();
    }

    if (!config.socName && (socModel || board)) {
      socName = socModel || board.toUpperCase();
    }

    if (!config.osName && androidVer) {
      const goSuffix = lowRam === 'true' ? ' Go' : '';
      osName = `Android ${androidVer}${goSuffix}`;
    }

    if (!tunnelUrl && psTunnel) {
      const subMatch = psTunnel.match(/(?:--subdomain|-s)\s+([a-zA-Z0-9_-]+)/);
      const urlMatch = psTunnel.match(/([a-zA-Z0-9_-]+\.loca\.lt)/);
      if (urlMatch) tunnelUrl = urlMatch[1];
      else if (subMatch) tunnelUrl = `${subMatch[1]}.loca.lt`;
    }
  }

  cachedHostInfo = {
    deviceName,
    socName,
    osName,
    ip,
    port: config.port,
    sshPort: config.sshPort,
    termuxUser,
    tunnelUrl: tunnelUrl || 'N/A',
    adbHost: isWin ? config.adbHostRemote : config.adbHostLocal
  };

  return cachedHostInfo;
}

module.exports = {
  discoverHostInfo,
  detectLocalIp
};

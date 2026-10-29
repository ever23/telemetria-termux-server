const fs = require('fs/promises');
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');
const { getAdbHost } = require('./adb');
const config = require('./config');

let lastNetCheck = 0;
let cachedNetData = null;

let prevRxBytes = 0;
let prevTxBytes = 0;
let prevRateTime = 0;
let rxRateFormatted = '0.0 KB/s';
let txRateFormatted = '0.0 KB/s';
let rxRateBytesPerSec = 0;
let txRateBytesPerSec = 0;

function execAdb(args, timeout = 3500) {
  return new Promise((resolve) => {
    execFile('adb', args, { timeout, windowsHide: true }, (err, stdout) => {
      if (err) return resolve('');
      resolve(stdout || '');
    });
  });
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024 * 1024) {
    return `${+(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${+(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatRate(bytesPerSec) {
  if (bytesPerSec < 1024) {
    return `${bytesPerSec} B/s`;
  }
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSec / 1024 / 1024).toFixed(2)} MB/s`;
}

async function getNetDataFromAdb() {
  const adbHost = getAdbHost();
  const raw = await execAdb([
    '-s',
    adbHost,
    'shell',
    "cat /proc/net/dev; echo '===WIFI==='; dumpsys wifi | grep -i 'mWifiInfo SSID' | head -n 1"
  ]);

  let traffic = {
    rxFormatted: '0 MB',
    txFormatted: '0 MB',
    rxBytes: 0,
    txBytes: 0,
    rxRateFormatted,
    txRateFormatted,
    rxRateBytesPerSec,
    txRateBytesPerSec
  };

  let wifi = {
    ssid: 'Wi-Fi',
    interface: 'wlan0',
    rssi: -55,
    linkSpeedMbps: 72,
    quality: 'Excelente'
  };

  if (raw) {
    const parts = raw.split('===WIFI===');
    const netDev = parts[0] || '';
    const wifiDump = parts[1] || '';

    // Parsear wlan0 de netDev
    for (const line of netDev.split('\n')) {
      if (line.includes('wlan0:')) {
        const segs = line.split(':')[1].trim().split(/\s+/);
        const rx = parseInt(segs[0], 10) || 0;
        const tx = parseInt(segs[8], 10) || 0;

        const now = Date.now();
        if (prevRateTime > 0 && now > prevRateTime && prevRxBytes > 0) {
          const dtSec = (now - prevRateTime) / 1000;
          if (dtSec >= 0.8 && rx >= prevRxBytes) {
            rxRateBytesPerSec = Math.round((rx - prevRxBytes) / dtSec);
            txRateBytesPerSec = Math.round((tx - prevTxBytes) / dtSec);
            rxRateFormatted = formatRate(rxRateBytesPerSec);
            txRateFormatted = formatRate(txRateBytesPerSec);
          }
        }
        prevRxBytes = rx;
        prevTxBytes = tx;
        prevRateTime = now;

        traffic = {
          rxBytes: rx,
          txBytes: tx,
          rxFormatted: formatBytes(rx),
          txFormatted: formatBytes(tx),
          rxRateFormatted,
          txRateFormatted,
          rxRateBytesPerSec,
          txRateBytesPerSec
        };
        break;
      }
    }

    // Parsear wifiDump
    if (wifiDump) {
      const ssidM = wifiDump.match(/SSID:\s*([^,]+)/i);
      const rssiM = wifiDump.match(/RSSI:\s*(-?\d+)/i);
      const speedM = wifiDump.match(/Link speed:\s*(\d+)Mbps/i);

      if (ssidM) wifi.ssid = ssidM[1].trim().replace(/^"|"$/g, '');
      if (rssiM) wifi.rssi = parseInt(rssiM[1], 10);
      if (speedM) wifi.linkSpeedMbps = parseInt(speedM[1], 10);

      if (wifi.rssi < -75) wifi.quality = 'Débil';
      else if (wifi.rssi < -65) wifi.quality = 'Buena';
      else wifi.quality = 'Excelente';
    }
  }

  return { traffic, wifi };
}

function checkTunnelHealth(tunnelUrl) {
  const clean = (tunnelUrl || '').trim();
  if (!clean || clean === 'N/A' || clean === 'tunnel.local') {
    return Promise.resolve({
      configured: false,
      url: '',
      online: false,
      statusCode: 0,
      latencyMs: 0,
      note: 'Sin configurar'
    });
  }

  const fullUrl = clean.startsWith('http') ? clean : `https://${clean}`;

  return new Promise((resolve) => {
    const start = Date.now();
    const client = fullUrl.startsWith('https') ? https : http;

    const req = client.get(fullUrl, { timeout: 4000, headers: { 'User-Agent': 'Termux-Telemetry-Ping/1.0' } }, (res) => {
      const latencyMs = Date.now() - start;
      resolve({
        configured: true,
        url: clean.replace(/^https?:\/\//, ''),
        online: res.statusCode < 500,
        statusCode: res.statusCode,
        latencyMs,
        note: res.statusCode === 200 ? 'En línea (200 OK)' : `HTTP ${res.statusCode}`
      });
      res.resume();
    });

    req.on('error', (err) => {
      resolve({
        configured: true,
        url: clean.replace(/^https?:\/\//, ''),
        online: false,
        statusCode: 0,
        latencyMs: Date.now() - start,
        note: 'Inaccesible'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        configured: true,
        url: clean.replace(/^https?:\/\//, ''),
        online: false,
        statusCode: 408,
        latencyMs: 4000,
        note: 'Timeout (4s)'
      });
    });
  });
}

async function getNetworkTelemetry(explicitTunnel) {
  const now = Date.now();
  if (cachedNetData && now - lastNetCheck < 2500) {
    return cachedNetData;
  }

  const tunnelTarget = explicitTunnel || config.tunnelUrl;

  const [{ traffic, wifi }, tunnel] = await Promise.all([
    getNetDataFromAdb(),
    checkTunnelHealth(tunnelTarget)
  ]);

  cachedNetData = {
    traffic,
    wifi,
    tunnel
  };
  lastNetCheck = now;

  return cachedNetData;
}

module.exports = {
  getNetworkTelemetry,
  checkTunnelHealth
};

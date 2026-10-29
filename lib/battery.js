const fs = require('fs/promises');
const config = require('./config');

const SYS_BAT = '/sys/class/power_supply/battery';

async function readSysFile(file) {
  try {
    const data = await fs.readFile(`${SYS_BAT}/${file}`, 'utf8');
    return data.trim();
  } catch (_) {
    return null;
  }
}

async function getBatteryMetrics(adbData) {
  // 1. Lectura directa desde SysFS (cero sobrecarga si SELinux lo permite)
  const capRaw = await readSysFile('capacity');
  if (capRaw !== null) {
    const tempRaw = await readSysFile('temp');
    const statusRaw = await readSysFile('status');
    const voltRaw = await readSysFile('voltage_now');

    const level = parseInt(capRaw, 10) || 100;
    const temperature = tempRaw ? +(parseInt(tempRaw, 10) / 10).toFixed(1) : 31.0;
    const voltage = voltRaw ? +(parseInt(voltRaw, 10) / 1000000).toFixed(2) : 4.2;

    const statusTranslate = {
      Charging: 'Cargando',
      Discharging: 'Descargando',
      Full: 'Completa',
      'Not charging': 'En línea (UPS)'
    };

    return {
      level,
      temperature,
      voltage,
      status: statusTranslate[statusRaw] || statusRaw || 'Cargando',
      plugged: config.powerSource || '5V UPS',
      source: 'sysfs'
    };
  }

  // 2. Datos obtenidos por puente ADB (dumpsys battery)
  if (adbData && adbData.battery) {
    return adbData.battery;
  }

  // 3. Fallback seguro (desarrollo local en PC sin ADB conectado)
  return {
    level: 88,
    temperature: 31.4,
    voltage: 4.18,
    status: 'Cargando (UPS)',
    plugged: config.powerSource || '5V UPS',
    source: 'fallback'
  };
}

module.exports = {
  getBatteryMetrics
};

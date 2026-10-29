<template>
  <div class="launcher-container">
    <!-- Header Superior Estilo Rack Server -->
    <header class="launcher-header">
      <div class="header-brand">
        <div class="brand-avatar">M</div>
        <div class="brand-info">
          <div class="brand-title-row">
            <h1 class="brand-name">{{ telemetry.server.deviceName || 'Moto E20' }}</h1>
            <span class="server-tag">24/7 SERVER</span>
          </div>
          <div class="brand-sub">
            <span class="live-dot"></span>
            <span>Uptime {{ telemetry.uptime.systemFormatted || 'En línea' }}</span>
            <span class="sub-sep">•</span>
            <span>{{ telemetry.server.ip || '127.0.0.1' }}</span>
          </div>
        </div>
      </div>

      <div class="header-actions">
        <button class="btn-icon" title="Refrescar métricas" @click="$emit('refresh')">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Barra de Pestañas Rápidas (Scroll Horizontal) -->
    <nav class="sub-nav-bar">
      <button
        class="nav-pill"
        :class="{ active: currentSubView === 'dashboard' }"
        @click="currentSubView = 'dashboard'"
      >
        ⚡ Monitor
      </button>
      <button
        class="nav-pill"
        :class="{ active: currentSubView === 'pm2' }"
        @click="currentSubView = 'pm2'"
      >
        ⚙️ PM2 ({{ telemetry.pm2.length }})
      </button>
      <button
        class="nav-pill"
        :class="{ active: currentSubView === 'android' }"
        @click="currentSubView = 'android'"
      >
        🤖 Android
      </button>
      <button
        class="nav-pill"
        :class="{ active: currentSubView === 'logs' }"
        @click="currentSubView = 'logs'"
      >
        📋 Logs
      </button>
      <button
        class="nav-pill"
        :class="{ active: currentSubView === 'screen' }"
        @click="currentSubView = 'screen'"
      >
        📱 Pantalla
      </button>
    </nav>

    <!-- VISTA PRINCIPAL: Monitor (Grid 2x2 + Mini Gráfica + Mini PM2) -->
    <main v-if="currentSubView === 'dashboard'" class="launcher-content">
      <!-- Grid 2x2 Compacto -->
      <section class="kpi-grid-compact">
        <!-- CPU Card -->
        <div class="card-kpi">
          <div class="kpi-head">
            <span class="kpi-title">Uso CPU</span>
            <span class="kpi-tag green">{{ telemetry.cpu.cores.length }}C</span>
          </div>
          <div class="kpi-num">{{ telemetry.cpu.usage }}%</div>
          <div class="kpi-foot">
            <span class="muted">Load: {{ (telemetry.cpu.loadAvg[0] || 0).toFixed(2) }}</span>
            <div class="mini-bar-track">
              <div class="mini-bar-fill" :style="{ width: `${Math.min(100, telemetry.cpu.usage)}%` }"></div>
            </div>
          </div>
        </div>

        <!-- RAM Card -->
        <div class="card-kpi">
          <div class="kpi-head">
            <span class="kpi-title">RAM Libre</span>
            <span class="kpi-tag" :class="telemetry.ram.freePercent < 15 ? 'red' : 'green'">
              {{ telemetry.ram.freePercent }}%
            </span>
          </div>
          <div class="kpi-num">{{ telemetry.ram.usedGb }} GB</div>
          <div class="kpi-foot">
            <span class="muted">Total {{ telemetry.ram.totalGb }} GB</span>
            <div class="mini-bar-track">
              <div class="mini-bar-fill" :style="{ width: `${telemetry.ram.percent}%` }"></div>
            </div>
          </div>
        </div>

        <!-- Batería & Temp Card -->
        <div class="card-kpi">
          <div class="kpi-head">
            <span class="kpi-title">Batería &amp; Temp</span>
            <span class="kpi-tag" :class="telemetry.battery.temperature >= 40 ? 'red' : 'green'">
              {{ telemetry.battery.temperature }}°C
            </span>
          </div>
          <div class="kpi-num">{{ telemetry.battery.level }}%</div>
          <div class="kpi-foot">
            <span class="muted">{{ telemetry.battery.status || 'Alimentado' }}</span>
          </div>
        </div>

        <!-- Red & Túnel Card -->
        <div class="card-kpi">
          <div class="kpi-head">
            <span class="kpi-title">Red wlan0</span>
            <span class="kpi-tag" :class="telemetry.network.tunnel?.online ? 'green' : 'red'">
              {{ telemetry.network.tunnel?.online ? 'Túnel OK' : 'Offline' }}
            </span>
          </div>
          <div class="kpi-rate-row">
            <span class="rate-down">↓ {{ telemetry.network.traffic?.rxRateFormatted || '0 KB/s' }}</span>
            <span class="rate-up">↑ {{ telemetry.network.traffic?.txRateFormatted || '0 KB/s' }}</span>
          </div>
          <div class="kpi-foot">
            <span class="muted">Ping: {{ telemetry.network.tunnel?.latencyMs || 0 }}ms</span>
          </div>
        </div>
      </section>

      <!-- Mini Gráfica de Tendencia (90px) -->
      <section class="mini-chart-box">
        <div class="chart-header-row">
          <span class="chart-title">Rendimiento en tiempo real</span>
          <div class="chart-toggles">
            <button :class="{ active: chartMetric === 'cpu' }" @click="chartMetric = 'cpu'">CPU</button>
            <button :class="{ active: chartMetric === 'ram' }" @click="chartMetric = 'ram'">RAM</button>
          </div>
        </div>
        <div class="mini-svg-wrap">
          <svg viewBox="0 0 320 85" preserveAspectRatio="none" class="chart-svg">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00E676" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#00E676" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path v-if="chartAreaPath" :d="chartAreaPath" fill="url(#chartGrad)" />
            <path v-if="chartLinePath" :d="chartLinePath" fill="none" stroke="#00E676" stroke-width="2" />
          </svg>
        </div>
      </section>

      <!-- Mini Lista de Servicios PM2 -->
      <section class="mini-pm2-box">
        <div class="pm2-head-row">
          <span class="section-title">Servicios Activos (PM2)</span>
          <span class="badge-count">{{ telemetry.pm2.filter(p => p.status === 'online').length }} en línea</span>
        </div>

        <div class="pm2-list">
          <div v-for="proc in telemetry.pm2" :key="proc.id" class="pm2-compact-row">
            <div class="proc-left">
              <span class="proc-status-dot" :class="proc.status"></span>
              <strong class="proc-name">{{ proc.name }}</strong>
              <small class="proc-role" v-if="proc.role">{{ proc.role }}</small>
            </div>
            <div class="proc-right">
              <span class="proc-metrics">{{ proc.memoryMb }} MB • {{ proc.cpu }}%</span>
              <button
                class="btn-restart-mini"
                title="Reiniciar proceso"
                @click="$emit('restart-pm2', proc.name)"
              >
                ↻
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- SUB-VISTAS (PM2 Detallado, Android OS, Logs, Pantalla) -->
    <main v-else class="subview-content">
      <div class="subview-header">
        <button class="back-pill" @click="currentSubView = 'dashboard'">
          ← Volver al Monitor
        </button>
      </div>

      <div v-if="currentSubView === 'pm2'">
        <Pm2Table :processes="telemetry.pm2" @restart="$emit('restart-pm2', $event)" />
      </div>

      <div v-else-if="currentSubView === 'android'">
        <AndroidProcTable
          :processes="androidProc.processes"
          :summary="androidProc.summary"
        />
      </div>

      <div v-else-if="currentSubView === 'logs'">
        <LogViewer @notify="$emit('notify', $event)" />
      </div>

      <div v-else-if="currentSubView === 'screen'">
        <DonutCard
          :ram="telemetry.ram"
          :screen-state="telemetry.screen.state"
          :screen-label="telemetry.screen.label"
          :loading="loadingScreen"
          @screen-on="$emit('screen-action', 'on')"
          @screen-off="$emit('screen-action', 'off')"
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import Pm2Table from './Pm2Table.vue';
import AndroidProcTable from './AndroidProcTable.vue';
import LogViewer from './LogViewer.vue';
import DonutCard from './DonutCard.vue';

const props = defineProps({
  telemetry: {
    type: Object,
    required: true
  },
  androidProc: {
    type: Object,
    default: () => ({ summary: {}, processes: [] })
  },
  loadingScreen: {
    type: Boolean,
    default: false
  }
});

defineEmits(['refresh', 'restart-pm2', 'screen-action', 'notify']);

const currentSubView = ref('dashboard');
const chartMetric = ref('cpu');

// Mini Gráfica SVG simplificada para móvil
const chartLinePath = computed(() => {
  const history = props.telemetry.history || [];
  if (history.length < 2) return '';

  const w = 320;
  const h = 85;
  const pad = 6;
  const step = (w - pad * 2) / (history.length - 1);

  const points = history.map((pt, idx) => {
    const val = chartMetric.value === 'cpu' ? (pt.cpu || 0) : (pt.ram || 0);
    const y = h - pad - (val / 100) * (h - pad * 2);
    const x = pad + idx * step;
    return `${x},${y}`;
  });

  return `M ${points.join(' L ')}`;
});

const chartAreaPath = computed(() => {
  if (!chartLinePath.value) return '';
  const history = props.telemetry.history || [];
  const w = 320;
  const h = 85;
  const pad = 6;
  const lastX = pad + (w - pad * 2);
  return `${chartLinePath.value} L ${lastX},${h} L ${pad},${h} Z`;
});
</script>

<style scoped>
.launcher-container {
  min-height: 100vh;
  background: #060a08;
  color: #f0fdf4;
  padding: 8px 10px 80px; /* 80px libres abajo para el boton nativo de Android */
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 480px;
  margin: 0 auto;
  box-sizing: border-box;
}

/* Header */
.launcher-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 12px;
  padding: 8px 10px;
}
.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-avatar {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #0b3b24, #061c12);
  border: 1.5px solid #00e676;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #00e676;
  font-size: 0.8rem;
}
.brand-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.brand-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}
.server-tag {
  background: rgba(0, 230, 118, 0.15);
  color: #00e676;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
}
.brand-sub {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  color: #8b9d93;
}
.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00e676;
}
.sub-sep {
  color: #3e5246;
}
.btn-icon {
  background: #0d1a13;
  border: 1px solid #1e3a2b;
  color: #8b9d93;
  border-radius: 8px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.btn-icon:hover {
  color: #00e676;
}

/* Sub Nav Pills */
.sub-nav-bar {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0 4px;
  scrollbar-width: none;
}
.sub-nav-bar::-webkit-scrollbar {
  display: none;
}
.nav-pill {
  background: #09120e;
  border: 1px solid #162e22;
  color: #8b9d93;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
  cursor: pointer;
}
.nav-pill.active {
  background: rgba(0, 230, 118, 0.16);
  color: #00e676;
  border-color: #00e676;
}

/* Launcher Content */
.launcher-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* KPI Grid 2x2 */
.kpi-grid-compact {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.card-kpi {
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 74px;
}
.kpi-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.kpi-title {
  font-size: 0.7rem;
  color: #8b9d93;
  font-weight: 500;
}
.kpi-tag {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 999px;
}
.kpi-tag.green {
  background: rgba(0, 230, 118, 0.14);
  color: #00e676;
}
.kpi-tag.red {
  background: rgba(239, 68, 68, 0.16);
  color: #f87171;
}
.kpi-num {
  font-size: 1.28rem;
  font-weight: 700;
  color: #ffffff;
  margin: 2px 0;
  letter-spacing: -0.02em;
}
.kpi-rate-row {
  display: flex;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  margin: 2px 0;
}
.rate-down {
  color: #00e676;
}
.rate-up {
  color: #38bdf8;
}
.kpi-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.65rem;
}
.muted {
  color: #677b70;
}
.mini-bar-track {
  width: 45px;
  height: 4px;
  background: #162e22;
  border-radius: 999px;
  overflow: hidden;
}
.mini-bar-fill {
  height: 100%;
  background: #00e676;
  border-radius: 999px;
}

/* Mini Chart */
.mini-chart-box {
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 10px;
  padding: 8px 10px 4px;
}
.chart-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.chart-title {
  font-size: 0.72rem;
  color: #8b9d93;
  font-weight: 600;
}
.chart-toggles {
  display: flex;
  gap: 2px;
  background: #060a08;
  border: 1px solid #162e22;
  border-radius: 999px;
  padding: 1px;
}
.chart-toggles button {
  background: transparent;
  border: none;
  color: #8b9d93;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  cursor: pointer;
}
.chart-toggles button.active {
  background: #00e676;
  color: #04140b;
}
.mini-svg-wrap {
  width: 100%;
  height: 75px;
}
.chart-svg {
  width: 100%;
  height: 100%;
}

/* Mini PM2 */
.mini-pm2-box {
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 10px;
  padding: 8px 10px;
}
.pm2-head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.section-title {
  font-size: 0.72rem;
  color: #8b9d93;
  font-weight: 600;
}
.badge-count {
  font-size: 0.62rem;
  color: #00e676;
  background: rgba(0, 230, 118, 0.12);
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 600;
}
.pm2-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pm2-compact-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #060a08;
  border: 1px solid #11241a;
  border-radius: 6px;
  padding: 5px 8px;
}
.proc-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.proc-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f87171;
}
.proc-status-dot.online {
  background: #00e676;
  box-shadow: 0 0 5px #00e676;
}
.proc-name {
  font-size: 0.75rem;
  color: #ffffff;
}
.proc-role {
  font-size: 0.65rem;
  color: #677b70;
}
.proc-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.proc-metrics {
  font-size: 0.68rem;
  color: #8b9d93;
}
.btn-restart-mini {
  background: #0d1a13;
  border: 1px solid #162e22;
  color: #00e676;
  font-size: 0.75rem;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

/* Sub-views */
.subview-header {
  margin-bottom: 8px;
}
.back-pill {
  background: #09120e;
  border: 1px solid #162e22;
  color: #00e676;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
}
</style>

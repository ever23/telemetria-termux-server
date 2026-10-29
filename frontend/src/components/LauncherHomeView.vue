<template>
  <div class="launcher-shell">
    <!-- Pistas Deslizables Horizontales (Swipe Lateral tipo Launcher) -->
    <div
      ref="pagesTrack"
      class="pages-track"
      @scroll.passive="handleTrackScroll"
    >
      <!-- ================= PÁGINA 1: MONITOR PRINCIPAL ================= -->
      <section class="launcher-page page-kiosk">
        <!-- Header Superior -->
        <header class="page-header">
          <div class="header-left">
            <div class="brand-avatar">M</div>
            <div class="brand-meta">
              <div class="brand-title">
                <strong>{{ telemetry.server.deviceName || 'Moto E20' }}</strong>
                <span class="tag-live">24/7 SERVER</span>
              </div>
              <div class="brand-sub">
                <span class="pulse-dot"></span>
                <span>Uptime {{ telemetry.uptime.systemFormatted || 'En línea' }}</span>
                <span class="sep">•</span>
                <span>{{ telemetry.server.ip || '127.0.0.1' }}</span>
              </div>
            </div>
          </div>

          <div class="header-right">
            <span class="live-tag">EN VIVO (1s)</span>
          </div>
        </header>

        <!-- Grid 2x2 Ultra-Comprimido -->
        <div class="grid-2x2">
          <!-- CPU -->
          <div class="tile-kpi">
            <div class="tile-top">
              <span class="tile-label">Uso CPU</span>
              <span class="tile-badge green">{{ telemetry.cpu.cores.length }}C</span>
            </div>
            <div class="tile-val">{{ telemetry.cpu.usage }}%</div>
            <div class="tile-bottom">
              <span class="muted">Load: {{ (telemetry.cpu.loadAvg[0] || 0).toFixed(2) }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: `${Math.min(100, telemetry.cpu.usage)}%` }"></div>
              </div>
            </div>
          </div>

          <!-- RAM -->
          <div class="tile-kpi">
            <div class="tile-top">
              <span class="tile-label">RAM Libre</span>
              <span class="tile-badge" :class="telemetry.ram.freePercent < 15 ? 'red' : 'green'">
                {{ telemetry.ram.freePercent }}%
              </span>
            </div>
            <div class="tile-val">{{ telemetry.ram.usedGb }} GB</div>
            <div class="tile-bottom">
              <span class="muted">Total {{ telemetry.ram.totalGb }} GB</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: `${telemetry.ram.percent}%` }"></div>
              </div>
            </div>
          </div>

          <!-- Batería -->
          <div class="tile-kpi">
            <div class="tile-top">
              <span class="tile-label">Batería &amp; Temp</span>
              <span class="tile-badge" :class="telemetry.battery.temperature >= 40 ? 'red' : 'green'">
                {{ telemetry.battery.temperature }}°C
              </span>
            </div>
            <div class="tile-val">{{ telemetry.battery.level }}%</div>
            <div class="tile-bottom">
              <span class="muted">{{ telemetry.battery.status || 'Alimentado' }}</span>
            </div>
          </div>

          <!-- Red & Túnel -->
          <div class="tile-kpi">
            <div class="tile-top">
              <span class="tile-label">Red wlan0</span>
              <span class="tile-badge" :class="telemetry.network.tunnel?.online ? 'green' : 'red'">
                {{ telemetry.network.tunnel?.online ? 'Túnel OK' : 'Offline' }}
              </span>
            </div>
            <div class="tile-rates">
              <span class="rate-down">↓ {{ telemetry.network.traffic?.rxRateFormatted || '0 KB/s' }}</span>
              <span class="rate-up">↑ {{ telemetry.network.traffic?.txRateFormatted || '0 KB/s' }}</span>
            </div>
            <div class="tile-bottom">
              <span class="muted">Ping: {{ telemetry.network.tunnel?.latencyMs || 0 }}ms</span>
            </div>
          </div>
        </div>

        <!-- Minigráfica en Tiempo Real (80px) -->
        <div class="chart-tile">
          <div class="chart-header">
            <span class="chart-label">Carga en tiempo real</span>
            <div class="chart-switch">
              <button :class="{ active: chartMetric === 'cpu' }" @click="chartMetric = 'cpu'">CPU</button>
              <button :class="{ active: chartMetric === 'ram' }" @click="chartMetric = 'ram'">RAM</button>
            </div>
          </div>
          <div class="chart-svg-wrap">
            <svg viewBox="0 0 320 80" preserveAspectRatio="none" class="chart-svg">
              <defs>
                <linearGradient id="liveAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#00E676" stop-opacity="0.38" />
                  <stop offset="100%" stop-color="#00E676" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <path v-if="chartAreaPath" :d="chartAreaPath" fill="url(#liveAreaGrad)" />
              <path v-if="chartLinePath" :d="chartLinePath" fill="none" stroke="#00E676" stroke-width="2" />
            </svg>
          </div>
        </div>

        <!-- Mini Lista PM2 -->
        <div class="pm2-tile">
          <div class="pm2-header">
            <span class="pm2-title">Servicios Activos (PM2)</span>
            <span class="pm2-badge">{{ telemetry.pm2.filter(p => p.status === 'online').length }} online</span>
          </div>
          <div class="pm2-items">
            <div v-for="proc in telemetry.pm2" :key="proc.id" class="pm2-row">
              <div class="proc-info">
                <span class="dot" :class="proc.status"></span>
                <strong class="name">{{ proc.name }}</strong>
                <small class="role" v-if="proc.role">{{ proc.role }}</small>
              </div>
              <div class="proc-actions">
                <span class="stats">{{ proc.memoryMb }} MB • {{ proc.cpu }}%</span>
                <button
                  class="btn-restart"
                  title="Reiniciar servicio"
                  @click="$emit('restart-pm2', proc.name)"
                >
                  ↻
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="swipe-hint">
          <span>Desliza a los lados para más paneles ➔</span>
        </div>
      </section>

      <!-- ================= PÁGINA 2: PM2 COMPLETO & ANDROID OS ================= -->
      <section class="launcher-page page-detail">
        <div class="detail-header">
          <h2>Procesos PM2 &amp; Android OS</h2>
          <span class="muted">Panel 2 de 3</span>
        </div>

        <div class="detail-scroll">
          <Pm2Table :processes="telemetry.pm2" @restart="$emit('restart-pm2', $event)" />
          <AndroidProcTable
            :processes="androidProc.processes"
            :summary="androidProc.summary"
          />
        </div>
      </section>

      <!-- ================= PÁGINA 3: LOGS & CONTROL DE PANTALLA ================= -->
      <section class="launcher-page page-detail">
        <div class="detail-header">
          <h2>Visor de Logs &amp; Hardware</h2>
          <span class="muted">Panel 3 de 3</span>
        </div>

        <div class="detail-scroll">
          <DonutCard
            :ram="telemetry.ram"
            :screen-state="telemetry.screen.state"
            :screen-label="telemetry.screen.label"
            :loading="loadingScreen"
            @screen-on="$emit('screen-action', 'on')"
            @screen-off="$emit('screen-action', 'off')"
          />
          <LogViewer @notify="$emit('notify', $event)" />
        </div>
      </section>
    </div>

    <!-- Indicador de Paginación Estilo Launcher (● ○ ○) -->
    <div class="launcher-dots">
      <span
        v-for="i in 3"
        :key="i"
        class="dot-indicator"
        :class="{ active: currentPage === (i - 1) }"
        @click="scrollToPage(i - 1)"
      ></span>
    </div>
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

defineEmits(['restart-pm2', 'screen-action', 'notify']);

const pagesTrack = ref(null);
const currentPage = ref(0);
const chartMetric = ref('cpu');

function handleTrackScroll(e) {
  const el = e.target;
  if (!el) return;
  const pageIndex = Math.round(el.scrollLeft / el.clientWidth);
  if (pageIndex !== currentPage.value) {
    currentPage.value = pageIndex;
  }
}

function scrollToPage(index) {
  if (!pagesTrack.value) return;
  const w = pagesTrack.value.clientWidth;
  pagesTrack.value.scrollTo({
    left: index * w,
    behavior: 'smooth'
  });
  currentPage.value = index;
}

// Mini Gráfica SVG en tiempo real (320x80)
const chartLinePath = computed(() => {
  const history = props.telemetry.history || [];
  if (history.length < 2) return '';

  const w = 320;
  const h = 80;
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
  const h = 80;
  const pad = 6;
  const lastX = pad + (w - pad * 2);
  return `${chartLinePath.value} L ${lastX},${h} L ${pad},${h} Z`;
});
</script>

<style scoped>
/* Contenedor Raíz: 100vh exactos, bloqueo total de scroll vertical y pull-to-refresh */
.launcher-shell {
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  background: #060a08;
  color: #f0fdf4;
  overflow: hidden;
  position: relative;
  touch-action: pan-x;
  overscroll-behavior: none;
  user-select: none;
}

/* Pista Horizontal Deslizable con Snap a 60 FPS */
.pages-track {
  display: flex;
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  scrollbar-width: none;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
  overscroll-behavior-y: none;
}
.pages-track::-webkit-scrollbar {
  display: none;
}

/* Cada Página Ocupa el 100% de la Pantalla */
.launcher-page {
  min-width: 100vw;
  max-width: 100vw;
  height: 100%;
  flex-shrink: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  box-sizing: border-box;
  padding: 8px 10px 88px; /* 88px libres para dots e icono de apps */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}

/* Página 1 (Kiosk): Sin ningún scroll, todo cabe en la altura */
.page-kiosk {
  gap: 6px;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 10px;
  padding: 6px 10px;
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-avatar {
  width: 26px;
  height: 26px;
  background: linear-gradient(135deg, #0b3b24, #061c12);
  border: 1.5px solid #00e676;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #00e676;
  font-size: 0.75rem;
}
.brand-title {
  display: flex;
  align-items: center;
  gap: 6px;
}
.brand-title strong {
  font-size: 0.82rem;
  color: #ffffff;
}
.tag-live {
  background: rgba(0, 230, 118, 0.15);
  color: #00e676;
  font-size: 0.58rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 4px;
}
.brand-sub {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  color: #8b9d93;
}
.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00e676;
  box-shadow: 0 0 6px #00e676;
}
.sep {
  color: #2a3d32;
}
.live-tag {
  font-size: 0.62rem;
  font-weight: 700;
  color: #00e676;
  background: rgba(0, 230, 118, 0.1);
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(0, 230, 118, 0.25);
}

/* Grid 2x2 */
.grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  flex-shrink: 0;
}
.tile-kpi {
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 10px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 68px;
}
.tile-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tile-label {
  font-size: 0.68rem;
  color: #8b9d93;
  font-weight: 500;
}
.tile-badge {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 999px;
}
.tile-badge.green {
  background: rgba(0, 230, 118, 0.14);
  color: #00e676;
}
.tile-badge.red {
  background: rgba(239, 68, 68, 0.16);
  color: #f87171;
}
.tile-val {
  font-size: 1.18rem;
  font-weight: 700;
  color: #ffffff;
  margin: 1px 0;
  letter-spacing: -0.02em;
}
.tile-rates {
  display: flex;
  gap: 6px;
  font-size: 0.74rem;
  font-weight: 700;
  margin: 1px 0;
}
.rate-down {
  color: #00e676;
}
.rate-up {
  color: #38bdf8;
}
.tile-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.62rem;
}
.muted {
  color: #677b70;
}
.bar-track {
  width: 42px;
  height: 4px;
  background: #162e22;
  border-radius: 999px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: #00e676;
  border-radius: 999px;
}

/* Gráfica SVG */
.chart-tile {
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 10px;
  padding: 6px 8px 2px;
  flex-shrink: 0;
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}
.chart-label {
  font-size: 0.68rem;
  color: #8b9d93;
  font-weight: 600;
}
.chart-switch {
  display: flex;
  gap: 2px;
  background: #060a08;
  border: 1px solid #162e22;
  border-radius: 999px;
  padding: 1px;
}
.chart-switch button {
  background: transparent;
  border: none;
  color: #8b9d93;
  font-size: 0.6rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  cursor: pointer;
}
.chart-switch button.active {
  background: #00e676;
  color: #04140b;
}
.chart-svg-wrap {
  width: 100%;
  height: 65px;
}
.chart-svg {
  width: 100%;
  height: 100%;
}

/* Mini PM2 */
.pm2-tile {
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 10px;
  padding: 6px 8px;
  flex-shrink: 0;
}
.pm2-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.pm2-title {
  font-size: 0.68rem;
  color: #8b9d93;
  font-weight: 600;
}
.pm2-badge {
  font-size: 0.58rem;
  color: #00e676;
  background: rgba(0, 230, 118, 0.12);
  padding: 1px 5px;
  border-radius: 999px;
  font-weight: 600;
}
.pm2-items {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.pm2-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #060a08;
  border: 1px solid #11241a;
  border-radius: 6px;
  padding: 4px 6px;
}
.proc-info {
  display: flex;
  align-items: center;
  gap: 5px;
}
.proc-info .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f87171;
}
.proc-info .dot.online {
  background: #00e676;
  box-shadow: 0 0 5px #00e676;
}
.proc-info .name {
  font-size: 0.72rem;
  color: #ffffff;
}
.proc-info .role {
  font-size: 0.62rem;
  color: #677b70;
}
.proc-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}
.proc-actions .stats {
  font-size: 0.65rem;
  color: #8b9d93;
}
.btn-restart {
  background: #0d1a13;
  border: 1px solid #162e22;
  color: #00e676;
  font-size: 0.7rem;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.swipe-hint {
  text-align: center;
  font-size: 0.62rem;
  color: #4a5e52;
  padding: 2px 0;
}

/* Páginas de Detalle (2 y 3) */
.page-detail {
  justify-content: flex-start;
  gap: 8px;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
.detail-header h2 {
  font-size: 0.88rem;
  margin: 0;
  color: #ffffff;
}
.detail-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 20px;
  scrollbar-width: thin;
}

/* Indicadores de Paginación Estilo Launcher (● ○ ○) */
.launcher-dots {
  position: absolute;
  bottom: 60px; /* Arriba del boton nativo de aplicaciones */
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
  z-index: 10;
}
.dot-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1a3325;
  transition: all 0.25s ease;
  cursor: pointer;
}
.dot-indicator.active {
  width: 18px;
  border-radius: 999px;
  background: #00e676;
  box-shadow: 0 0 8px rgba(0, 230, 118, 0.6);
}
</style>

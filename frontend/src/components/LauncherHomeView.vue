<template>
  <div class="launcher-shell">
    <!-- Pistas Deslizables Horizontales (Swipe Lateral tipo Launcher) -->
    <div
      ref="pagesTrack"
      class="pages-track"
      @scroll.passive="handleTrackScroll"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <!-- ================= PÁGINA 1: MONITOR EN VIVO (KIOSK) ================= -->
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

        <!-- Barra de Puertos HTTP con Acceso por Código QR -->
        <div v-if="telemetry.httpServices && telemetry.httpServices.length" class="ports-qr-bar">
          <span class="ports-qr-label">HTTP:</span>
          <div class="ports-chips-wrap">
            <button
              v-for="svc in telemetry.httpServices"
              :key="svc.port + svc.url"
              class="port-chip-btn"
              :class="{ 'tunnel-chip': svc.isTunnel }"
              @click="openQr(svc)"
            >
              <span class="chip-dot"></span>
              <span class="chip-title">{{ svc.isTunnel ? (svc.name.includes('Notas') ? '☁️ Notas' : svc.name.includes('Telemetría') ? '☁️ Telemetría' : `☁️ ${svc.name}`) : `:${svc.port} ${svc.name}` }}</span>
              <span class="chip-qr-icon">📷 QR</span>
            </button>
          </div>
        </div>

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
          <span>◀ Desliza a los lados para cambiar de página ▶</span>
        </div>
      </section>

      <!-- ================= PÁGINA 2: SERVICIOS & PROCESOS (SIN SCROLL) ================= -->
      <section class="launcher-page page-panel2">
        <header class="page-header">
          <div class="header-left">
            <div class="brand-avatar">⚙</div>
            <div class="brand-meta">
              <div class="brand-title">
                <strong>Servicios &amp; Procesos</strong>
              </div>
              <div class="brand-sub">
                <span>PM2 &amp; Sistema Android • Panel 2 de 3</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Bloque 1: Servicios PM2 Completos -->
        <div class="card-compact">
          <div class="card-compact-header">
            <span class="card-compact-title">Servicios Node.js (PM2)</span>
            <span class="tag-count">{{ telemetry.pm2.length }} procesos</span>
          </div>
          <div class="pm2-card-list">
            <div
              v-for="proc in telemetry.pm2"
              :key="proc.id + '-' + proc.name"
              class="pm2-full-row"
            >
              <div class="proc-col-left">
                <div class="proc-name-line">
                  <span class="dot" :class="proc.status"></span>
                  <strong class="proc-strong">{{ proc.name }}</strong>
                </div>
                <div class="proc-sub-line">
                  <span>{{ proc.uptime || 'online' }}</span>
                  <span v-if="proc.restarts > 0" class="restarts-sub">({{ proc.restarts }}↻)</span>
                </div>
              </div>

              <div class="proc-col-right">
                <div class="proc-metrics">
                  <span class="mem-tag">{{ proc.memoryMb }} MB</span>
                  <span class="cpu-tag">{{ proc.cpu }}% CPU</span>
                </div>
                <button
                  class="btn-restart-large"
                  title="Reiniciar servicio"
                  @click="$emit('restart-pm2', proc.name)"
                >
                  ↻
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Bloque 2: Top Procesos del Sistema Android & Swap/ZRAM -->
        <div class="card-compact">
          <div class="card-compact-header">
            <span class="card-compact-title">Top Procesos Android / Termux</span>
            <span class="tag-zram">ZRAM: {{ androidProc.summary?.swapPercent || 0 }}%</span>
          </div>

          <!-- Barra de ZRAM / Swap -->
          <div class="zram-bar-row">
            <div class="zram-bar-track">
              <div
                class="zram-bar-fill"
                :style="{ width: `${Math.min(100, androidProc.summary?.swapPercent || 0)}%` }"
              ></div>
            </div>
            <div class="zram-labels">
              <span>Swap Usado: {{ androidProc.summary?.swapUsedMb || 0 }} MB</span>
              <span>Total: {{ androidProc.summary?.swapTotalMb || 0 }} MB</span>
            </div>
          </div>

          <!-- Lista de los 4 procesos principales -->
          <div class="android-proc-list">
            <div
              v-for="proc in topAndroidProcesses"
              :key="proc.pid"
              class="android-proc-row"
            >
              <div class="proc-info-cell">
                <span class="pid-badge">#{{ proc.pid }}</span>
                <span class="cmd-text">{{ proc.cmd.split('/').pop().slice(0, 22) }}</span>
              </div>
              <div class="proc-stat-cell">
                <span class="res-mb">{{ proc.resMb }} MB</span>
                <span class="cpu-pct" :class="{ warn: proc.cpu > 5 }">{{ proc.cpu }}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ================= PÁGINA 3: TERMINAL & LOGS EN VIVO ================= -->
      <section class="launcher-page page-panel3">
        <header class="page-header">
          <div class="header-left">
            <div class="brand-avatar">⚡</div>
            <div class="brand-meta">
              <div class="brand-title">
                <strong>Terminal &amp; Logs en Vivo</strong>
                <span class="tag-live">STREAMING</span>
              </div>
              <div class="brand-sub">
                <span class="pulse-dot"></span>
                <span>PM2 &amp; Sistema • RAM: {{ telemetry.ram.usedGb }} GB ({{ telemetry.ram.freePercent }}% libre)</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Terminal de Logs Integrada en Vivo -->
        <div class="launcher-logviewer-container">
          <LogViewer
            :server-name="telemetry.server?.deviceName || 'motoe20'"
            @notify="$emit('notify', $event)"
          />
        </div>
      </section>
    </div>

    <!-- Indicador de Paginación Estilo Launcher (● ○ ○) -->
    <div class="launcher-dots">
      <span
        v-for="i in 3"
        :key="i"
        class="dot-indicator-hitbox"
        @click="scrollToPage(i - 1)"
      >
        <span
          class="dot-indicator"
          :class="{ active: currentPage === (i - 1) }"
        ></span>
      </span>
    </div>

    <!-- Modal Código QR para Acceso a Servicios HTTP -->
    <QrModal
      v-model="showQrModal"
      :service="selectedQrService"
      @notify="$emit('notify', $event)"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import QrModal from './QrModal.vue';
import LogViewer from './LogViewer.vue';

const showQrModal = ref(false);
const selectedQrService = ref(null);

function openQr(svc) {
  selectedQrService.value = svc;
  showQrModal.value = true;
}

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

defineEmits(['restart-pm2', 'notify']);

const pagesTrack = ref(null);
const currentPage = ref(0);
const chartMetric = ref('cpu');

// Top 4 procesos de Android para que no desborde la pantalla
const topAndroidProcesses = computed(() => {
  const list = props.androidProc?.processes || [];
  return list.slice(0, 4);
});

// Gesto táctil ultra sensible (Swipe de 35px cambia de pantalla al instante)
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

function onTouchStart(e) {
  if (!e.touches || e.touches.length === 0) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
}

function onTouchEnd(e) {
  if (!e.changedTouches || e.changedTouches.length === 0) return;
  const deltaX = e.changedTouches[0].clientX - touchStartX;
  const deltaY = e.changedTouches[0].clientY - touchStartY;
  const deltaTime = Date.now() - touchStartTime;

  // Si el movimiento fue predominantemente horizontal
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 35) {
    if (deltaX < 0 && currentPage.value < 2) {
      // Swipe hacia la izquierda -> avanzar página
      scrollToPage(currentPage.value + 1);
    } else if (deltaX > 0 && currentPage.value > 0) {
      // Swipe hacia la derecha -> retroceder página
      scrollToPage(currentPage.value - 1);
    }
  }
}

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

// Donut SVG Math
const donutCircumference = 2 * Math.PI * 36; // ~226.2
const donutUsedDash = computed(() => {
  const pct = Math.max(5, Math.min(95, props.telemetry.ram?.percent || 60));
  return +((pct / 100) * donutCircumference).toFixed(1);
});

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

/* Pista Horizontal Deslizable con Snap */
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

/* Cada Página Ocupa el 100% de la Pantalla sin desbordar verticalmente */
.launcher-page {
  min-width: 100vw;
  max-width: 100vw;
  height: 100%;
  flex-shrink: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  box-sizing: border-box;
  padding: 8px 10px 84px; /* 84px libres para dots e icono de apps */
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 7px;
  overflow: hidden;
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

/* Barra de Puertos y Códigos QR */
.ports-qr-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 8px;
  padding: 3px 8px;
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}
.ports-qr-bar::-webkit-scrollbar {
  display: none;
}
.ports-qr-label {
  font-size: 0.58rem;
  font-weight: 800;
  color: #00e676;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.ports-chips-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow-x: auto;
  scrollbar-width: none;
}
.ports-chips-wrap::-webkit-scrollbar {
  display: none;
}
.port-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #050c08;
  border: 1px solid #143524;
  color: #ffffff;
  font-size: 0.62rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.port-chip-btn:hover, .port-chip-btn:active {
  border-color: #00e676;
  background: #0b2216;
}
.port-chip-btn .chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #00e676;
  box-shadow: 0 0 4px #00e676;
}
.port-chip-btn.tunnel-chip {
  border-color: #0284c7;
}
.port-chip-btn.tunnel-chip .chip-dot {
  background: #38bdf8;
  box-shadow: 0 0 4px #38bdf8;
}
.chip-qr-icon {
  font-size: 0.58rem;
  color: #00e676;
  background: rgba(0, 230, 118, 0.15);
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 700;
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
  min-height: 66px;
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
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
  margin: 1px 0;
  letter-spacing: -0.02em;
}
.tile-rates {
  display: flex;
  gap: 6px;
  font-size: 0.72rem;
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
  height: 60px;
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
  font-size: 0.6rem;
  color: #4a5e52;
  padding: 1px 0;
}

/* ================= COMPACT CARDS PARA PÁGINAS 2 Y 3 ================= */
.card-compact {
  background: #09120e;
  border: 1px solid #162e22;
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}
.card-compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-compact-title {
  font-size: 0.74rem;
  font-weight: 700;
  color: #f0fdf4;
}
.tag-count, .tag-zram {
  font-size: 0.6rem;
  font-weight: 600;
  color: #00e676;
  background: rgba(0, 230, 118, 0.12);
  padding: 1px 6px;
  border-radius: 999px;
}

/* PM2 List en Panel 2 */
.pm2-card-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.pm2-full-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #060a08;
  border: 1px solid #11241a;
  border-radius: 8px;
  padding: 6px 8px;
}
.proc-col-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.proc-name-line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.proc-name-line .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f87171;
}
.proc-name-line .dot.online {
  background: #00e676;
  box-shadow: 0 0 5px #00e676;
}
.proc-strong {
  font-size: 0.76rem;
  color: #ffffff;
}
.proc-sub-line {
  font-size: 0.62rem;
  color: #677b70;
}
.restarts-sub {
  color: #eab308;
  margin-left: 3px;
}
.proc-col-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.proc-metrics {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}
.mem-tag {
  font-size: 0.7rem;
  font-weight: 700;
  color: #00e676;
}
.cpu-tag {
  font-size: 0.62rem;
  color: #8b9d93;
}
.btn-restart-large {
  background: #0d1a13;
  border: 1px solid #162e22;
  color: #00e676;
  font-size: 0.82rem;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-weight: bold;
}

/* ZRAM & Android Procs en Panel 2 */
.zram-bar-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 2px 0 4px;
}
.zram-bar-track {
  width: 100%;
  height: 6px;
  background: #11241a;
  border-radius: 999px;
  overflow: hidden;
}
.zram-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #00e676, #38bdf8);
  border-radius: 999px;
}
.zram-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.6rem;
  color: #8b9d93;
}
.android-proc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.android-proc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #060a08;
  border: 1px solid #102117;
  border-radius: 6px;
  padding: 4px 6px;
}
.proc-info-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pid-badge {
  font-size: 0.58rem;
  color: #677b70;
  background: #09120e;
  padding: 1px 4px;
  border-radius: 4px;
}
.cmd-text {
  font-size: 0.68rem;
  color: #ffffff;
  font-family: monospace;
}
.proc-stat-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.res-mb {
  font-size: 0.66rem;
  font-weight: 700;
  color: #00e676;
}
.cpu-pct {
  font-size: 0.62rem;
  color: #8b9d93;
}
.cpu-pct.warn {
  color: #f87171;
  font-weight: bold;
}

/* Panel 3: Terminal de Logs en Vivo Adaptada al Launcher */
.launcher-logviewer-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 24px;
}

.launcher-logviewer-container :deep(.terminal-window) {
  height: 100% !important;
  min-height: 0 !important;
  border-radius: 12px;
  background: #030805;
  border: 1px solid #102619;
}

.launcher-logviewer-container :deep(.terminal-titlebar) {
  padding: 8px 10px;
}

.launcher-logviewer-container :deep(.terminal-toolbar) {
  padding: 6px 8px;
  gap: 6px;
}

.launcher-logviewer-container :deep(.source-select) {
  max-width: 140px;
  font-size: 0.68rem;
  padding: 4px 6px;
}

.launcher-logviewer-container :deep(.terminal-search-input) {
  width: 90px;
  font-size: 0.68rem;
}

.launcher-logviewer-container :deep(.tool-btn) {
  padding: 3px 6px;
  font-size: 0.65rem;
}

.launcher-logviewer-container :deep(.terminal-screen) {
  flex: 1;
  min-height: 120px;
  max-height: none;
  font-size: 0.7rem;
  line-height: 1.4;
  padding: 8px 10px;
}

.launcher-logviewer-container :deep(.terminal-footer) {
  padding: 4px 8px;
  font-size: 0.65rem;
}

/* Indicadores de Paginación Estilo Launcher (● ○ ○) */
.launcher-dots {
  position: absolute;
  bottom: 58px; /* Arriba del boton nativo de aplicaciones */
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  pointer-events: auto;
  z-index: 10;
}
.dot-indicator-hitbox {
  padding: 10px 8px; /* Área táctil generosa para tocar con el pulgar */
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dot-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1a3325;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: block;
}
.dot-indicator.active {
  width: 18px;
  border-radius: 999px;
  background: #00e676;
  box-shadow: 0 0 8px rgba(0, 230, 118, 0.6);
}
</style>

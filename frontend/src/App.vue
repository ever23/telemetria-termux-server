<template>
  <LoginView v-if="authState === 'login'" @success="onLoginSuccess" />

  <div v-else-if="authState === 'ready'" class="dashboard-shell">
    <!-- Navegación Lateral (PC) e Inferior (Móvil) -->
    <SidebarNav
      :active-tab="activeTab"
      :server="telemetry.server"
      @select="activeTab = $event"
    />

    <!-- Área Principal -->
    <main class="main-area">
      <!-- Topbar Escritorio y Móvil -->
      <header class="topbar">
        <!-- Encabezado Móvil Superior (Igual a la referencia móvil Inbyte) -->
        <div class="mobile-brand-bar">
          <div class="brand-inline">
            <div class="brand-badge sm">{{ (telemetry.server.deviceName || 'T').charAt(0).toUpperCase() }}</div>
            <span class="brand-name">{{ telemetry.server.deviceName }}</span>
          </div>
          <div class="mobile-live-indicator">
            <span class="pulse-dot"></span>
            <span>{{ telemetry.uptime.systemFormatted || 'Activo' }}</span>
          </div>
        </div>

        <!-- Buscador estilo Inbyte (Escritorio) -->
        <div class="search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar proceso PM2, puerto o métrica..."
          />
        </div>

        <!-- Sub-barra Móvil: Título 'Dashboard' + Selector de intervalo -->
        <div class="topbar-actions">
          <h1 class="mobile-page-title">{{ pageTitle }}</h1>

          <div class="right-controls">
            <div class="interval-selector" title="Intervalo de actualización">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <select v-model.number="refreshMs" @change="restartPolling">
                <option :value="2000">Tiempo real (2s)</option>
                <option :value="3000">Cada 3 seg</option>
                <option :value="5000">Cada 5 seg</option>
                <option :value="10000">Cada 10 seg</option>
                <option :value="0">Pausado</option>
              </select>
            </div>

            <button
              class="icon-action-btn"
              title="Actualizar ahora"
              @click="fetchTelemetry"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>

            <button
              v-if="authConfigured"
              class="icon-action-btn"
              title="Cerrar sesión"
              @click="logout"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>

            <div class="server-avatar" :title="`Uptime: ${telemetry.uptime.systemFormatted}`">
              <span>{{ (telemetry.server.deviceName || 'TX').replace(/\s+/g, '').slice(-3).toUpperCase() }}</span>
              <i class="online-ring"></i>
            </div>
          </div>
        </div>
      </header>

      <!-- Aviso cuando el servidor no tiene contraseña configurada -->
      <div v-if="!authConfigured" class="auth-warning">
        ⚠ Panel sin contraseña: modo solo lectura y control de pantalla bloqueado.
        Ejecuta <code>npm run set-password</code> en el servidor.
      </div>

      <!-- Notificación flotante al encender/apagar pantalla ADB -->
      <transition name="fade">
        <div v-if="toastMessage" class="adb-toast">
          <span class="pulse-dot"></span>
          <span>{{ toastMessage }}</span>
        </div>
      </transition>

      <!-- Contenido Principal en Grid Estilo Inbyte -->
      <div class="content-grid">
        <!-- Columna Central / Izquierda (KPIs + Gráficas + Tabla PM2) -->
        <section class="center-column">
          <!-- Fila 1: 3 Tarjetas KPI Superiores -->
          <div
            v-show="activeTab === 'dashboard' || activeTab === 'hardware'"
            class="kpi-row"
          >
            <KpiCard
              title="Uso de CPU"
              :value="`${telemetry.cpu.usage}%`"
              :badge="`Load ${telemetry.cpu.loadAvg?.[0] ?? '0.35'}`"
              :subtext="telemetry.cpu.model"
              :variant="telemetry.cpu.usage > 80 ? 'danger' : 'positive'"
              :icon="icons.cpu"
            />

            <KpiCard
              title="Memoria RAM"
              :value="`${telemetry.ram.usedGb} GB`"
              :badge="`${telemetry.ram.freePercent}% libre`"
              :subtext="`Total ${telemetry.ram.totalGb} GB`"
              :variant="telemetry.ram.percent > 80 ? 'danger' : 'positive'"
              :icon="icons.ram"
            />

            <KpiCard
              title="Batería & Temp"
              :value="`${telemetry.battery.level}% • ${telemetry.battery.temperature}°C`"
              :badge="`+${telemetry.battery.status}`"
              :subtext="`Uptime ${telemetry.uptime.systemFormatted}`"
              :variant="telemetry.battery.temperature >= 40 ? 'danger' : 'positive'"
              :icon="icons.battery"
            />
          </div>

          <!-- Fila 2: Gráfica de Línea Suave + Barras de Núcleos -->
          <div
            v-show="activeTab === 'dashboard' || activeTab === 'hardware'"
            class="charts-row"
          >
            <LineChart :history="telemetry.history" />
            <CoreBars
              :cores="telemetry.cpu.cores"
              :model="telemetry.cpu.model"
              :load-avg="telemetry.cpu.loadAvg"
            />
          </div>

          <!-- Fila 3: Tabla de Procesos PM2 (Solo lectura) -->
          <div v-show="activeTab === 'dashboard' || activeTab === 'pm2'">
            <Pm2Table :processes="filteredPm2" />
          </div>
        </section>

        <!-- Columna Derecha (Donut Chart + Control de Pantalla ADB) -->
        <aside
          v-show="activeTab === 'dashboard' || activeTab === 'screen' || activeTab === 'hardware'"
          class="right-column"
        >
          <DonutCard
            :ram="telemetry.ram"
            :battery="telemetry.battery"
            :screen="telemetry.screen"
            :uptime="telemetry.uptime"
            :server="telemetry.server"
            :loading-action="loadingScreen || !authConfigured"
            @screen-action="handleScreenAction"
          />
        </aside>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import SidebarNav from './components/SidebarNav.vue';
import KpiCard from './components/KpiCard.vue';
import LineChart from './components/LineChart.vue';
import CoreBars from './components/CoreBars.vue';
import DonutCard from './components/DonutCard.vue';
import Pm2Table from './components/Pm2Table.vue';
import LoginView from './components/LoginView.vue';

const authState = ref('loading'); // 'loading' | 'login' | 'ready'
const authConfigured = ref(true);

const activeTab = ref('dashboard');
const searchQuery = ref('');
const refreshMs = ref(3000);
const loadingScreen = ref(false);
const toastMessage = ref('');
let pollTimer = null;

const telemetry = reactive({
  server: {
    deviceName: 'Termux',
    socName: '',
    ip: '',
    port: 3055,
    sshPort: 8022,
    termuxUser: '',
    tunnelUrl: '',
    adbHost: ''
  },
  cpu: {
    usage: 0,
    model: '',
    cores: [],
    loadAvg: [0, 0, 0]
  },
  ram: {
    totalMb: 0,
    usedMb: 0,
    availableMb: 0,
    cachedMb: 0,
    totalGb: 0,
    usedGb: 0,
    percent: 0,
    cachedPercent: 0,
    freePercent: 0
  },
  battery: {
    level: 0,
    temperature: 0,
    voltage: 0,
    status: '...',
    plugged: ''
  },
  screen: {
    state: 'OFF',
    label: ''
  },
  uptime: {
    systemFormatted: '--',
    processFormatted: '--',
    selfMemoryMb: 0
  },
  pm2: [],
  history: []
});

const icons = {
  cpu: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  ram: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="10" y1="12" x2="10.01" y2="12"/><line x1="14" y1="12" x2="14.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/></svg>`,
  battery: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><polyline points="11 9 8 12 12 12 9 15"/></svg>`
};

const pageTitle = computed(() => {
  const titles = {
    dashboard: 'Dashboard',
    pm2: 'Procesos PM2',
    hardware: 'Hardware & CPU',
    screen: 'Pantalla ADB'
  };
  return titles[activeTab.value] || 'Dashboard';
});

const filteredPm2 = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return telemetry.pm2;
  return telemetry.pm2.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.role && p.role.toLowerCase().includes(q)) ||
      String(p.pid).includes(q)
  );
});

async function fetchTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    if (res.status === 401) {
      goToLogin();
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    if (data.server) Object.assign(telemetry.server, data.server);
    if (data.cpu) Object.assign(telemetry.cpu, data.cpu);
    if (data.ram) Object.assign(telemetry.ram, data.ram);
    if (data.battery) Object.assign(telemetry.battery, data.battery);
    if (data.screen) Object.assign(telemetry.screen, data.screen);
    if (data.uptime) Object.assign(telemetry.uptime, data.uptime);
    if (Array.isArray(data.pm2)) telemetry.pm2 = data.pm2;
    if (Array.isArray(data.history)) telemetry.history = data.history;
  } catch (_) {
    // Mantiene última lectura si hay micro-corte de red
  }
}

async function handleScreenAction(mode) {
  loadingScreen.value = true;
  try {
    const res = await fetch(`/api/screen/${mode}`, { method: 'POST' });
    const data = await res.json();
    if (res.status === 401) {
      goToLogin();
      return;
    }
    if (!res.ok) {
      showToast(data.error || 'Acción no permitida');
      return;
    }
    if (data.screen) {
      telemetry.screen.state = data.screen;
    }
    showToast(
      mode === 'on'
        ? 'Comando ADB enviado: Pantalla ENCENDIDA (keyevent 224)'
        : 'Comando ADB enviado: Pantalla EN REPOSO (keyevent 223)'
    );
  } catch (_) {
    showToast('Error al ejecutar script ADB de pantalla');
  } finally {
    loadingScreen.value = false;
  }
}

function showToast(msg) {
  toastMessage.value = msg;
  setTimeout(() => {
    toastMessage.value = '';
  }, 3200);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function restartPolling() {
  stopPolling();
  if (refreshMs.value > 0 && authState.value === 'ready') {
    pollTimer = setInterval(fetchTelemetry, refreshMs.value);
  }
}

function goToLogin() {
  stopPolling();
  authState.value = 'login';
}

function startDashboard() {
  authState.value = 'ready';
  fetchTelemetry();
  restartPolling();
}

async function onLoginSuccess() {
  authConfigured.value = true;
  startDashboard();
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  goToLogin();
}

onMounted(async () => {
  try {
    const res = await fetch('/api/auth/status');
    const status = await res.json();
    authConfigured.value = status.configured;
    if (status.configured && !status.authenticated) {
      authState.value = 'login';
      return;
    }
  } catch (_) {
    // Si falla el estado, se intenta cargar igualmente; un 401 redirigirá al login
  }
  startDashboard();
});

onUnmounted(stopPolling);
</script>

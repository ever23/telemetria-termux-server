<template>
  <div class="right-column-stack">
    <!-- Tarjeta Donut (Estilo 'Máquinas' de la referencia) -->
    <div class="card donut-card">
      <div class="donut-header-row">
        <h3 class="card-title">Memoria &amp; Nodo</h3>
        <span class="chevron-icon">›</span>
      </div>

      <div class="donut-layout">
        <div class="donut-svg-box">
          <svg viewBox="0 0 140 140" class="donut-svg">
            <!-- Anillo base (Libre) -->
            <circle
              cx="70"
              cy="70"
              r="50"
              fill="none"
              stroke="#0B3B24"
              stroke-width="22"
            />
            <!-- Segmento Caché/Buffers -->
            <circle
              cx="70"
              cy="70"
              r="50"
              fill="none"
              stroke="#009E52"
              stroke-width="22"
              :stroke-dasharray="`${cacheDash} ${circumference}`"
              :stroke-dashoffset="-usedDash"
              transform="rotate(-90 70 70)"
            />
            <!-- Segmento Usada Activa (Verde Neón Principal) -->
            <circle
              cx="70"
              cy="70"
              r="50"
              fill="none"
              stroke="#00E676"
              stroke-width="22"
              :stroke-dasharray="`${usedDash} ${circumference}`"
              stroke-dashoffset="0"
              transform="rotate(-90 70 70)"
            />
            <!-- Etiqueta de porcentaje dentro del anillo -->
            <text
              x="70"
              y="75"
              text-anchor="middle"
              class="donut-center-text"
            >
              {{ ram.percent || 60 }}%
            </text>
          </svg>
        </div>

        <!-- Resumen lateral (Visible en móvil y compacto en escritorio) -->
        <div class="donut-side-stats">
          <div class="side-stat-item">
            <span class="dot neon"></span>
            <div>
              <div class="side-stat-label">En uso activo</div>
              <div class="side-stat-val">{{ ram.usedMb || 1150 }} MB</div>
            </div>
          </div>
          <div class="side-stat-item">
            <span class="dot dark-green"></span>
            <div>
              <div class="side-stat-label">Disponible</div>
              <div class="side-stat-val">{{ ram.availableMb || 744 }} MB</div>
            </div>
          </div>
        </div>
      </div>

      <div class="donut-legend">
        <span class="legend-item">
          <i class="dot neon"></i> Usada {{ ram.percent || 60 }}%
        </span>
        <span class="legend-item">
          <i class="dot mid-green"></i> Caché {{ ram.cachedPercent || 18 }}%
        </span>
        <span class="legend-item">
          <i class="dot dark-green"></i> Libre {{ ram.freePercent || 40 }}%
        </span>
      </div>
    </div>

    <!-- Tarjeta Control de Pantalla ADB y Detalles del Servidor -->
    <div class="card side-list-card">
      <div class="card-header compact">
        <h3 class="card-title">Control de Pantalla ADB</h3>
        <span
          class="screen-state-badge"
          :class="screen.state === 'ON' ? 'on' : 'off'"
        >
          {{ screen.state === 'ON' ? 'ENCENDIDA' : 'REPOSO' }}
        </span>
      </div>

      <p class="adb-target-label">
        ADB Wireless • <code>{{ server.adbHost || '127.0.0.1:5555' }}</code>
      </p>

      <div class="screen-btn-group">
        <button
          class="adb-btn wake-btn"
          :disabled="loadingAction"
          @click="$emit('screen-action', 'on')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
          </svg>
          <span>Encender (224)</span>
        </button>

        <button
          class="adb-btn sleep-btn"
          :disabled="loadingAction"
          @click="$emit('screen-action', 'off')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <span>Apagar (223)</span>
        </button>
      </div>

      <!-- Tabla lateral estilo 'Productos más vendidos' de la columna derecha -->
      <div class="mini-kv-table">
        <div class="mini-kv-head">
          <span>Parámetro</span>
          <span>Valor</span>
        </div>
        <div class="mini-kv-row">
          <span>Temp. Batería</span>
          <strong :class="{ 'temp-warn': (battery.temperature || 31) >= 40 }">
            {{ battery.temperature || 31.2 }} °C
          </strong>
        </div>
        <div class="mini-kv-row">
          <span>Voltaje / Fuente</span>
          <strong>{{ battery.voltage || '4.18' }}V • UPS</strong>
        </div>
        <div class="mini-kv-row">
          <span>RAM este Panel</span>
          <strong class="emerald-text">{{ uptime.selfMemoryMb || 13.4 }} MB</strong>
        </div>
        <div class="mini-kv-row">
          <span>Túnel Web</span>
          <strong>{{ server.tunnelUrl || 'N/A' }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  ram: { type: Object, default: () => ({}) },
  battery: { type: Object, default: () => ({}) },
  screen: { type: Object, default: () => ({ state: 'OFF' }) },
  uptime: { type: Object, default: () => ({}) },
  server: { type: Object, default: () => ({}) },
  loadingAction: { type: Boolean, default: false }
});

defineEmits(['screen-action']);

const circumference = 2 * Math.PI * 50; // ~314.16

const usedDash = computed(() => {
  const pct = Math.max(5, Math.min(95, props.ram.percent || 60));
  return +((pct / 100) * circumference).toFixed(1);
});

const cacheDash = computed(() => {
  const pct = Math.max(5, Math.min(40, props.ram.cachedPercent || 18));
  return +((pct / 100) * circumference).toFixed(1);
});
</script>

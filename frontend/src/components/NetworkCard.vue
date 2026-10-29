<template>
  <div class="card network-card">
    <div class="card-header compact">
      <div>
        <h3 class="card-title">Red, Wi-Fi &amp; Túnel</h3>
        <span class="card-subtitle">Conectividad y tráfico acumulado</span>
      </div>
      <div class="header-right">
        <span
          class="kpi-pill"
          :class="network.tunnel?.online ? 'positive' : 'danger'"
        >
          {{ network.tunnel?.online ? 'Túnel Activo' : (network.tunnel?.configured ? 'Túnel Caído' : 'Sin Configurar') }}
        </span>
      </div>
    </div>

    <div class="net-grid">
      <!-- Wi-Fi -->
      <div class="net-box">
        <div class="net-box-title">
          <span>Wi-Fi • {{ network.wifi?.ssid || 'EverWifi' }}</span>
          <strong class="quality-tag">{{ network.wifi?.quality || 'Excelente' }}</strong>
        </div>
        <div class="net-val-big">{{ network.wifi?.rssi || -10 }} dBm</div>
        <small class="muted-text">Enlace a {{ network.wifi?.linkSpeedMbps || 135 }} Mbps</small>
      </div>

      <!-- Tráfico RX / TX -->
      <div class="net-box">
        <div class="net-box-title">
          <span>Tráfico wlan0 (Kernel)</span>
          <span class="rate-badge">En vivo</span>
        </div>
        <div class="traffic-rate-row">
          <div class="rate-col">
            <span class="rate-icon down">↓</span>
            <span class="rate-val">{{ network.traffic?.rxRateFormatted || '0.0 KB/s' }}</span>
          </div>
          <div class="rate-col">
            <span class="rate-icon up">↑</span>
            <span class="rate-val">{{ network.traffic?.txRateFormatted || '0.0 KB/s' }}</span>
          </div>
        </div>
        <div class="traffic-totals">
          <small class="muted-text">
            Total: ↓ {{ network.traffic?.rxFormatted || '0 MB' }} • ↑ {{ network.traffic?.txFormatted || '0 MB' }}
          </small>
        </div>
      </div>

      <!-- Túnel Web Salud -->
      <div class="net-box tunnel-box">
        <div class="net-box-title">
          <div class="tunnel-title-row">
            <span>Túnel</span>
            <button class="edit-btn" title="Configurar URL del túnel" @click="startEdit">
              ⚙️ Configurar
            </button>
          </div>
          <span class="status-code">{{ network.tunnel?.statusCode ? `HTTP ${network.tunnel.statusCode}` : 'Ping' }}</span>
        </div>

        <div v-if="!isEditing" class="tunnel-display">
          <div class="latency-val">
            {{ network.tunnel?.latencyMs || 0 }} ms
          </div>
          <div class="tunnel-link-row">
            <small class="muted-text">{{ network.tunnel?.note || 'Sin configurar' }}</small>
            <a
              v-if="network.tunnel?.url"
              :href="`https://${network.tunnel.url}`"
              target="_blank"
              class="ext-link"
              title="Abrir túnel en pestaña nueva"
            >
              {{ network.tunnel.url }} ↗
            </a>
          </div>
        </div>

        <div v-else class="tunnel-edit-form">
          <input
            v-model="inputUrl"
            type="text"
            placeholder="ej: notas-uppt.loca.lt"
            class="tunnel-input"
            @keyup.enter="save"
          />
          <div class="edit-actions">
            <button class="btn-xs primary" :disabled="saving" @click="save">
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
            <button class="btn-xs" @click="isEditing = false">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  network: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['save-tunnel']);

const isEditing = ref(false);
const inputUrl = ref('');
const saving = ref(false);

function startEdit() {
  inputUrl.value = props.network.tunnel?.url || '';
  isEditing.value = true;
}

function save() {
  const clean = inputUrl.value.trim().replace(/^https?:\/\//, '');
  saving.value = true;
  emit('save-tunnel', clean, () => {
    saving.value = false;
    isEditing.value = false;
  });
}
</script>

<style scoped>
.network-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.net-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.net-box {
  background: #09120e;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.net-box-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
  color: var(--text-muted);
}
.tunnel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.edit-btn {
  background: transparent;
  border: none;
  color: var(--neon-green);
  font-size: 0.72rem;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}
.edit-btn:hover {
  background: rgba(0, 230, 118, 0.1);
}
.quality-tag {
  color: var(--neon-green);
  font-size: 0.75rem;
}
.net-val-big {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--text-white);
}
.rate-badge {
  font-size: 0.68rem;
  padding: 1px 6px;
  background: rgba(0, 230, 118, 0.15);
  color: var(--neon-green);
  border-radius: 4px;
  font-weight: 600;
}
.traffic-rate-row {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 4px 0;
}
.rate-col {
  display: flex;
  align-items: center;
  gap: 6px;
}
.rate-icon {
  font-size: 1rem;
  font-weight: 800;
}
.rate-icon.down {
  color: var(--neon-green);
}
.rate-icon.up {
  color: #38bdf8;
}
.rate-val {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-white);
}
.traffic-totals {
  margin-top: 2px;
}
.traffic-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
}
.traffic-row strong {
  color: var(--text-white);
}
.latency-val {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--neon-green);
}
.status-code {
  font-size: 0.72rem;
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: var(--text-white);
}
.tunnel-link-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ext-link {
  color: var(--neon-green);
  text-decoration: none;
  font-size: 0.74rem;
  font-weight: 600;
}
.ext-link:hover {
  text-decoration: underline;
}
.muted-text {
  font-size: 0.75rem;
  color: var(--text-dim);
}
.tunnel-edit-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.tunnel-input {
  background: #060b08;
  border: 1px solid var(--border-emerald);
  color: var(--text-white);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.78rem;
  outline: none;
}
.tunnel-input:focus {
  border-color: var(--neon-green);
}
.edit-actions {
  display: flex;
  gap: 6px;
}
.btn-xs {
  background: #0d1a13;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  cursor: pointer;
}
.btn-xs.primary {
  background: var(--neon-green);
  color: #04140b;
  font-weight: 700;
  border-color: var(--neon-green);
}

@media (max-width: 768px) {
  .net-grid {
    grid-template-columns: 1fr;
  }
}
</style>

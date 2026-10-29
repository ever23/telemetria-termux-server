<template>
  <div class="card network-card">
    <div class="card-header compact">
      <div>
        <h3 class="card-title">Red, Wi-Fi &amp; Túnel</h3>
        <span class="card-subtitle">Conectividad y tráfico acumulado</span>
      </div>
      <span
        class="kpi-pill"
        :class="network.tunnel?.online ? 'positive' : 'danger'"
      >
        {{ network.tunnel?.online ? 'Túnel Activo' : 'Túnel Offline' }}
      </span>
    </div>

    <div class="net-grid">
      <!-- Wi-Fi -->
      <div class="net-box">
        <div class="net-box-title">
          <span>Señal Wi-Fi</span>
          <strong class="quality-tag">{{ network.wifi?.quality || 'OK' }}</strong>
        </div>
        <div class="net-val-big">{{ network.wifi?.rssi || -55 }} dBm</div>
        <small class="muted-text">Enlace a {{ network.wifi?.linkSpeedMbps || 72 }} Mbps</small>
      </div>

      <!-- Tráfico RX / TX -->
      <div class="net-box">
        <div class="net-box-title">
          <span>Tráfico de Red</span>
          <span class="muted-text">{{ network.wifi?.interface || 'wlan0' }}</span>
        </div>
        <div class="traffic-row">
          <span>↓ Descarga:</span>
          <strong>{{ network.traffic?.rxGb || '1.2' }} GB</strong>
        </div>
        <div class="traffic-row">
          <span>↑ Subida:</span>
          <strong>{{ network.traffic?.txGb || '0.8' }} GB</strong>
        </div>
      </div>

      <!-- Túnel Web Salud -->
      <div class="net-box tunnel-box">
        <div class="net-box-title">
          <span>Salud del Túnel</span>
          <span class="status-code">{{ network.tunnel?.statusCode ? `HTTP ${network.tunnel.statusCode}` : 'Ping' }}</span>
        </div>
        <div class="latency-val">
          {{ network.tunnel?.latencyMs || 0 }} ms
        </div>
        <small class="muted-text">{{ network.tunnel?.note || 'Verificando...' }}</small>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  network: {
    type: Object,
    default: () => ({})
  }
});
</script>

<style scoped>
.network-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
.quality-tag {
  color: var(--neon-green);
  font-size: 0.75rem;
}
.net-val-big {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--text-white);
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
.muted-text {
  font-size: 0.75rem;
  color: var(--text-dim);
}

@media (max-width: 768px) {
  .net-grid {
    grid-template-columns: 1fr;
  }
}
</style>

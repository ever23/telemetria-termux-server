<template>
  <div class="card storage-card">
    <div class="card-header compact">
      <div>
        <h3 class="card-title">Almacenamiento eMMC</h3>
        <span class="card-subtitle">Disco interno y Termux</span>
      </div>
      <span v-if="hasWarning" class="kpi-pill danger">Espacio Crítico</span>
      <span v-else class="kpi-pill positive">OK</span>
    </div>

    <div class="storage-list">
      <div v-for="item in mounts" :key="item.mount" class="storage-item">
        <div class="storage-meta">
          <span class="storage-name">{{ item.name }}</span>
          <span class="storage-vals">
            <strong>{{ item.availGb }} GB libres</strong> de {{ item.totalGb }} GB
          </span>
        </div>
        <div class="storage-bar-track">
          <div
            class="storage-bar-fill"
            :class="{ warning: item.percent > 85 }"
            :style="{ width: `${item.percent}%` }"
          ></div>
        </div>
        <div class="storage-footer-row">
          <small class="muted-text">{{ item.mount }}</small>
          <small :class="item.percent > 85 ? 'text-danger' : 'text-emerald'">
            {{ item.percent }}% en uso
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  mounts: {
    type: Array,
    default: () => []
  }
});

const hasWarning = computed(() => props.mounts.some((m) => m.isWarning || m.percent > 90));
</script>

<style scoped>
.storage-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.storage-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.storage-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.84rem;
  margin-bottom: 6px;
}
.storage-vals {
  color: var(--text-muted);
}
.storage-vals strong {
  color: var(--text-white);
}
.storage-bar-track {
  width: 100%;
  height: 8px;
  background: #09130e;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid #14261c;
}
.storage-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #00b85c, #00e676);
  transition: width 0.4s ease;
}
.storage-bar-fill.warning {
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}
.storage-footer-row {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.74rem;
}
.muted-text {
  color: var(--text-dim);
}
.text-danger {
  color: var(--danger);
  font-weight: 600;
}
.text-emerald {
  color: var(--neon-green);
  font-weight: 600;
}
</style>

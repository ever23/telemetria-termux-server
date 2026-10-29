<template>
  <div class="card bars-card">
    <div class="card-header">
      <div>
        <h3 class="card-title">Núcleos CPU</h3>
        <span class="card-subtitle">{{ model }} (8 Cores)</span>
      </div>
      <span class="load-tag">Load {{ loadAvg?.[0] ?? '0.35' }}</span>
    </div>

    <div class="bars-grid">
      <div
        v-for="core in displayCores"
        :key="core.id"
        class="bar-column"
        :title="`Núcleo ${core.label}: ${core.usage}%`"
      >
        <span class="bar-pct">{{ core.usage }}%</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            :style="{ height: `${Math.max(12, Math.min(100, core.usage))}%` }"
          ></div>
        </div>
        <span class="bar-label">{{ core.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  cores: {
    type: Array,
    default: () => []
  },
  model: {
    type: String,
    default: 'ARM64 SoC'
  },
  loadAvg: {
    type: Array,
    default: () => [0.35, 0.4, 0.32]
  }
});

const displayCores = computed(() => {
  if (props.cores && props.cores.length) {
    return props.cores.slice(0, 6);
  }
  return [
    { id: 1, label: '#1', usage: 28 },
    { id: 2, label: '#2', usage: 21 },
    { id: 3, label: '#3', usage: 24 },
    { id: 4, label: '#4', usage: 16 },
    { id: 5, label: '#5', usage: 26 },
    { id: 6, label: '#6', usage: 19 }
  ];
});
</script>

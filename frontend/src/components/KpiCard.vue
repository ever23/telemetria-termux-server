<template>
  <div class="kpi-card">
    <div class="kpi-top">
      <div class="kpi-info">
        <span class="kpi-label">{{ title }}</span>
        <div class="kpi-value">{{ value }}</div>
      </div>
      <div class="kpi-icon-box" v-html="icon"></div>
    </div>
    <div class="kpi-bottom">
      <span class="kpi-pill" :class="variant">
        {{ badge }}
      </span>
      <span v-if="subtext" class="kpi-subtext">{{ subtext }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  value: { type: String, required: true },
  badge: { type: String, required: true },
  subtext: { type: String, default: '' },
  variant: { type: String, default: 'positive' }, // 'positive' | 'warning' | 'danger'
  icon: { type: String, default: '' }
});
</script>

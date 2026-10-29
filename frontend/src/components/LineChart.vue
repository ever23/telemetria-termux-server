<template>
  <div class="card chart-card">
    <div class="card-header">
      <div>
        <h3 class="card-title">Telemetría reciente</h3>
        <span class="card-subtitle">Evolución en tiempo real ({{ metricLabel }})</span>
      </div>

      <div class="metric-switcher">
        <button
          class="switch-pill"
          :class="{ active: mode === 'cpu' }"
          @click="mode = 'cpu'"
        >
          CPU
        </button>
        <button
          class="switch-pill"
          :class="{ active: mode === 'ram' }"
          @click="mode = 'ram'"
        >
          RAM
        </button>
        <button
          class="switch-pill"
          :class="{ active: mode === 'temp' }"
          @click="mode = 'temp'"
        >
          Temp
        </button>
      </div>
    </div>

    <div class="svg-chart-wrapper">
      <svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" class="line-svg">
        <defs>
          <linearGradient id="emeraldAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#00E676" stop-opacity="0.34" />
            <stop offset="70%" stop-color="#00E676" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#00E676" stop-opacity="0.0" />
          </linearGradient>
          <filter id="neonGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Líneas de guía horizontales y etiquetas del eje Y -->
        <g v-for="(grid, gIdx) in gridLines" :key="gIdx">
          <line
            :x1="padLeft"
            :y1="grid.y"
            :x2="width - padRight"
            :y2="grid.y"
            stroke="#1A2821"
            stroke-dasharray="3 4"
            stroke-width="1"
          />
          <text
            :x="padLeft - 8"
            :y="grid.y + 4"
            text-anchor="end"
            class="axis-label"
          >
            {{ grid.label }}
          </text>
        </g>

        <!-- Área degradada bajo la curva -->
        <path v-if="areaPath" :d="areaPath" fill="url(#emeraldAreaGrad)" />

        <!-- Línea curva suave verde esmeralda neón -->
        <path
          v-if="linePath"
          :d="linePath"
          fill="none"
          stroke="#00E676"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          filter="url(#neonGlow)"
        />

        <!-- Punto final pulsante -->
        <g v-if="lastCoord">
          <circle :cx="lastCoord.x" :cy="lastCoord.y" r="6" fill="rgba(0, 230, 118, 0.25)" />
          <circle :cx="lastCoord.x" :cy="lastCoord.y" r="3.5" fill="#00E676" stroke="#08100C" stroke-width="1.5" />
        </g>

        <!-- Etiquetas del eje X -->
        <g v-for="(tick, tIdx) in xTicks" :key="tIdx">
          <text
            :x="tick.x"
            :y="height - 6"
            text-anchor="middle"
            class="axis-label"
          >
            {{ tick.label }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  history: {
    type: Array,
    default: () => []
  }
});

const mode = ref('cpu');
const width = 540;
const height = 210;
const padLeft = 46;
const padRight = 14;
const padTop = 18;
const padBottom = 28;

const metricLabel = computed(() => {
  if (mode.value === 'ram') return 'Memoria RAM %';
  if (mode.value === 'temp') return 'Temperatura °C';
  return 'Carga de CPU %';
});

const gridLines = computed(() => {
  const usableH = height - padTop - padBottom;
  const suffix = mode.value === 'temp' ? '°C' : '%';
  const topVal = mode.value === 'temp' ? 60 : 100;
  const midVal = mode.value === 'temp' ? 40 : 50;
  const lowVal = mode.value === 'temp' ? 20 : 10;

  return [
    { y: padTop, label: `${topVal}${suffix}` },
    { y: padTop + usableH * 0.5, label: `${midVal}${suffix}` },
    { y: padTop + usableH * 0.9, label: `${lowVal}${suffix}` }
  ];
});

const coords = computed(() => {
  const pts = props.history.length
    ? props.history
    : [{ time: '00:00', cpu: 18, ram: 60, temp: 31 }];

  const usableW = width - padLeft - padRight;
  const usableH = height - padTop - padBottom;
  const maxVal = mode.value === 'temp' ? 65 : 100;
  const minVal = mode.value === 'temp' ? 15 : 0;

  return pts.map((pt, i) => {
    const raw = Number(pt[mode.value] ?? 0);
    const clamped = Math.max(minVal, Math.min(maxVal, raw));
    const ratio = (clamped - minVal) / (maxVal - minVal);
    const x = pts.length === 1
      ? padLeft + usableW / 2
      : padLeft + (i / (pts.length - 1)) * usableW;
    const y = padTop + usableH * (1 - ratio);
    return { x, y, time: pt.time, value: raw };
  });
});

function buildSmoothBezier(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx1 = p0.x + (p1.x - p0.x) * 0.45;
    const cpy1 = p0.y;
    const cpx2 = p0.x + (p1.x - p0.x) * 0.55;
    const cpy2 = p1.y;
    d += ` C ${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

const linePath = computed(() => buildSmoothBezier(coords.value));

const areaPath = computed(() => {
  const pts = coords.value;
  if (!pts.length) return '';
  const baseLine = height - padBottom;
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${linePath.value} L ${last.x.toFixed(1)} ${baseLine} L ${first.x.toFixed(1)} ${baseLine} Z`;
});

const lastCoord = computed(() => {
  const pts = coords.value;
  return pts.length ? pts[pts.length - 1] : null;
});

const xTicks = computed(() => {
  const pts = coords.value;
  if (!pts.length) return [];
  const step = Math.max(1, Math.floor(pts.length / 6));
  const ticks = [];
  for (let i = 0; i < pts.length; i += step) {
    const shortTime = (pts[i].time || '').slice(3); // mm:ss
    ticks.push({ x: pts[i].x, label: shortTime || String(i + 1) });
  }
  return ticks;
});
</script>

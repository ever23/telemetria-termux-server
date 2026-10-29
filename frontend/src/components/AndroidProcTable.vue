<template>
  <div class="card android-proc-card">
    <div class="card-header">
      <div>
        <h3 class="card-title">Procesos Globales del Sistema Android</h3>
        <span class="card-subtitle">
          {{ summary.totalTasks || 0 }} Tareas • {{ summary.runningTasks || 0 }} Activas • Swap/ZRAM: {{ summary.swapPercent || 0 }}% ({{ summary.swapUsedMb || 0 }} MB / {{ summary.swapTotalMb || 0 }} MB)
        </span>
      </div>

      <div class="proc-search">
        <input
          v-model="query"
          type="text"
          placeholder="Filtrar por app, comando, PID..."
        />
      </div>
    </div>

    <div class="table-scroll">
      <table class="pm2-table">
        <thead>
          <tr>
            <th>PID</th>
            <th>Usuario</th>
            <th class="num-col">% CPU</th>
            <th class="num-col">% Mem</th>
            <th class="num-col">RAM (RES)</th>
            <th>Comando / App</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="proc in filtered" :key="proc.pid">
            <td class="proc-pid">#{{ proc.pid }}</td>
            <td>
              <span class="user-badge" :class="proc.user.startsWith('u0_a') ? 'user-app' : 'user-sys'">
                {{ proc.user }}
              </span>
            </td>
            <td class="num-col font-bold" :class="proc.cpu > 5 ? 'text-warn' : ''">
              {{ proc.cpu }}%
            </td>
            <td class="num-col muted-cell">{{ proc.memPct }}%</td>
            <td class="num-col font-bold">{{ proc.resMb }} MB</td>
            <td class="cmd-cell" :title="proc.cmd">{{ proc.cmd }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  processes: { type: Array, default: () => [] },
  summary: { type: Object, default: () => ({}) }
});

const query = ref('');

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.processes;
  return props.processes.filter(
    (p) =>
      String(p.pid).includes(q) ||
      p.user.toLowerCase().includes(q) ||
      p.cmd.toLowerCase().includes(q)
  );
});
</script>

<style scoped>
.android-proc-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.proc-search input {
  background: #09120d;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  padding: 6px 14px;
  color: var(--text-white);
  font-size: 0.8rem;
  outline: none;
}
.proc-search input:focus {
  border-color: var(--neon-green);
}
.table-scroll {
  width: 100%;
  max-height: 480px;
  overflow-y: auto;
}
.proc-pid {
  color: var(--text-muted);
  font-family: monospace;
}
.user-badge {
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 6px;
  font-weight: 600;
}
.user-app {
  background: rgba(0, 230, 118, 0.12);
  color: var(--neon-green);
}
.user-sys {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}
.font-bold {
  font-weight: 600;
}
.text-warn {
  color: #f59e0b !important;
}
.cmd-cell {
  max-width: 320px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.82rem;
  color: var(--text-white);
  font-family: monospace;
}
</style>

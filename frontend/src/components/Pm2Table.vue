<template>
  <div class="card pm2-card">
    <div class="pm2-table-wrap">
      <table class="pm2-table">
        <thead>
          <tr>
            <th>Procesos PM2 en ejecución</th>
            <th>Servicio / Rol</th>
            <th class="num-col">Memoria</th>
            <th class="num-col">CPU</th>
            <th class="num-col">Uptime</th>
            <th class="num-col">Estado</th>
            <th class="num-col">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="proc in processes" :key="proc.id + '-' + proc.name">
            <td class="proc-name-cell">
              <span class="proc-dot" :class="proc.status === 'online' ? 'online' : 'offline'"></span>
              <span class="proc-title">{{ proc.name }}</span>
            </td>
            <td class="muted-cell">{{ proc.role || `PID ${proc.pid}` }}</td>
            <td class="num-col">{{ proc.memoryMb }} MB</td>
            <td class="num-col">{{ proc.cpu }}%</td>
            <td class="num-col muted-cell">
              {{ proc.uptime }}
              <small v-if="proc.restarts > 0" class="restart-tag">({{ proc.restarts }}↻)</small>
            </td>
            <td class="num-col">
              <span class="status-badge" :class="proc.status === 'online' ? 'online' : 'offline'">
                {{ proc.status === 'online' ? 'ONLINE' : proc.status.toUpperCase() }}
              </span>
            </td>
            <td class="num-col">
              <button
                class="restart-btn"
                title="Reiniciar proceso"
                @click="$emit('restart', proc.name)"
              >
                ↻
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
defineProps({
  processes: {
    type: Array,
    default: () => []
  }
});

defineEmits(['restart']);
</script>

<style scoped>
.restart-btn {
  background: #0d1a13;
  border: 1px solid var(--border-emerald);
  color: var(--neon-green);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.15s;
}
.restart-btn:hover {
  background: var(--neon-green);
  color: #04140b;
}
</style>

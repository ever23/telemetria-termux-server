<template>
  <div class="card log-viewer-card">
    <div class="card-header">
      <div>
        <h3 class="card-title">Visor de Logs del Servidor</h3>
        <span class="card-subtitle">Últimas 45 líneas en vivo</span>
      </div>

      <div class="log-controls">
        <select v-model="selectedTarget" @change="fetchLog">
          <option value="backup">backup.log (GitHub 23:59)</option>
          <option value="tunnel">vigilante_tunel.log (Túnel)</option>
          <option value="pm2-notas">PM2 notas (ControlDeNotas)</option>
          <option value="pm2-telemetry">PM2 termux-telemetry</option>
        </select>

        <button class="btn-sm" :disabled="loading" @click="fetchLog">
          {{ loading ? 'Cargando…' : 'Refrescar' }}
        </button>

        <button class="btn-sm danger" :disabled="loading" @click="confirmClear">
          Vaciar Log
        </button>
      </div>
    </div>

    <div ref="terminalBox" class="terminal-body">
      <pre><code>{{ content || 'Cargando registros...' }}</code></pre>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['notify']);

const selectedTarget = ref('backup');
const content = ref('');
const loading = ref(false);
const terminalBox = ref(null);

async function fetchLog() {
  loading.value = true;
  try {
    const res = await fetch(`/api/logs/${selectedTarget.value}`);
    const data = await res.json();
    content.value = data.content || 'Sin registros';
    setTimeout(() => {
      if (terminalBox.value) terminalBox.value.scrollTop = terminalBox.value.scrollHeight;
    }, 50);
  } catch (_) {
    content.value = 'Error al consultar logs';
  } finally {
    loading.value = false;
  }
}

async function confirmClear() {
  if (!confirm(`¿Seguro que deseas vaciar el log "${selectedTarget.value}"?`)) return;
  loading.value = true;
  try {
    const res = await fetch(`/api/logs/${selectedTarget.value}/clear`, { method: 'POST' });
    const data = await res.json();
    emit('notify', data.message || 'Log vaciado');
    await fetchLog();
  } catch (_) {
    emit('notify', 'Error al vaciar log');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchLog);
</script>

<style scoped>
.log-viewer-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.log-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.log-controls select {
  background: #08100c;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--text-white);
  font-size: 0.8rem;
  outline: none;
}
.btn-sm {
  background: #0e1d15;
  border: 1px solid var(--border-emerald);
  color: var(--neon-green);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-sm:hover:not(:disabled) {
  background: var(--neon-green);
  color: #04140b;
}
.btn-sm.danger {
  border-color: rgba(239, 68, 68, 0.4);
  color: var(--danger);
  background: rgba(239, 68, 68, 0.08);
}
.btn-sm.danger:hover:not(:disabled) {
  background: var(--danger);
  color: #fff;
}
.terminal-body {
  background: #050a07;
  border: 1px solid #14221a;
  border-radius: 12px;
  padding: 14px;
  max-height: 420px;
  overflow-y: auto;
}
pre {
  margin: 0;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.78rem;
  color: #a7f3d0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}
</style>

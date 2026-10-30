<template>
  <div class="terminal-window" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- Barra Superior de la Terminal (Estilo macOS / Linux) -->
    <div class="terminal-titlebar">
      <div class="window-buttons">
        <span class="win-btn close" title="Cerrar" @click="clearScreen"></span>
        <span class="win-btn minimize" title="Pausar / Reanudar" @click="togglePause"></span>
        <span class="win-btn zoom" :title="isFullscreen ? 'Restaurar tamaño' : 'Maximizar a pantalla completa'" @click="toggleFullscreen"></span>
      </div>

      <div class="terminal-title">
        <span class="term-icon">⚡</span>
        <span class="term-host">termux@{{ serverName || 'motoe20' }}:~</span>
        <span class="term-cmd">tail -f {{ currentLogName }}</span>
      </div>

      <div class="terminal-status-wrap">
        <button
          class="fullscreen-toggle-btn"
          :title="isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Expandir a pantalla completa'"
          @click="toggleFullscreen"
        >
          {{ isFullscreen ? '🗗 Restaurar' : '🗖 Pantalla Completa' }}
        </button>
        <span class="live-pill" :class="connectionStatus">
          <span class="pulse-indicator"></span>
          <span>{{ statusLabel }}</span>
        </span>
      </div>
    </div>

    <!-- Barra de Herramientas de la Consola -->
    <div class="terminal-toolbar">
      <div class="toolbar-left">
        <!-- Selector con Autodetección Dinámica de Fuentes de Log -->
        <div class="source-select-wrap">
          <label for="logSourceSelect" class="sr-only">Fuente de Log</label>
          <select
            id="logSourceSelect"
            v-model="selectedTarget"
            class="source-select"
            @change="onTargetChange"
          >
            <option v-if="!groupedSources.length" value="" disabled>Buscando logs en el sistema...</option>
            <optgroup
              v-for="group in groupedSources"
              :key="group.name"
              :label="group.name"
            >
              <option
                v-for="src in group.items"
                :key="src.id"
                :value="src.id"
              >
                {{ src.name }}
              </option>
            </optgroup>
          </select>
          <button
            class="tool-btn icon-btn"
            title="Refrescar lista de procesos y archivos detectados"
            @click="refreshSourcesList"
          >
            ↻
          </button>
        </div>

        <!-- Buscador / Grep en Tiempo Real -->
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input
            v-model="filterQuery"
            type="text"
            placeholder="Filtrar (ej: error, 200, pm2)..."
            class="terminal-search-input"
          />
          <button
            v-if="filterQuery"
            class="clear-search-btn"
            title="Limpiar filtro"
            @click="filterQuery = ''"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <!-- Pausar / Reanudar Stream -->
        <button
          class="tool-btn"
          :class="{ active: isPaused }"
          :title="isPaused ? 'Reanudar flujo en vivo' : 'Pausar flujo en pantalla'"
          @click="togglePause"
        >
          <span>{{ isPaused ? '▶ Reanudar' : '⏸ Pausar' }}</span>
        </button>

        <!-- Auto-Scroll Toggle -->
        <button
          class="tool-btn"
          :class="{ active: autoScroll }"
          :title="autoScroll ? 'Auto-scroll activo (desplaza al final)' : 'Auto-scroll pausado'"
          @click="toggleAutoScroll"
        >
          <span>⤓ Scroll</span>
        </button>

        <!-- Limpiar pantalla -->
        <button
          class="tool-btn"
          title="Limpiar salida de la pantalla (clear)"
          @click="clearScreen"
        >
          <span>Limpiar</span>
        </button>

        <!-- Vaciar archivo de log en disco -->
        <button
          class="tool-btn danger"
          title="Vaciar archivo físico en el servidor (truncate/pm2 flush)"
          @click="confirmFlush"
        >
          <span>Vaciar</span>
        </button>
      </div>
    </div>

    <!-- Cuerpo de la Terminal -->
    <div
      ref="terminalScroll"
      class="terminal-screen"
      @wheel.passive="handleUserScroll"
      @touchmove.passive="handleUserScroll"
    >
      <div v-if="filteredLines.length === 0" class="terminal-empty">
        <span class="empty-comment"># Conectando con el stream de la terminal...</span>
        <span v-if="filterQuery" class="empty-comment"># No hay líneas que coincidan con "{{ filterQuery }}"</span>
      </div>

      <!-- Renderizado de Líneas con Coloreado Sintáctico -->
      <div
        v-for="(line, idx) in filteredLines"
        :key="idx"
        class="terminal-line"
      >
        <span class="line-number">{{ idx + 1 }}</span>
        <span class="line-content" v-html="highlightLogLine(line)"></span>
      </div>

      <!-- Prompt final estilo Bash con cursor parpadeante -->
      <div class="terminal-prompt-row">
        <span class="prompt-user">u0_a217@termux</span><span class="prompt-sep">:</span><span class="prompt-path">~</span><span class="prompt-char">$</span>
        <span class="prompt-cmd">tail -f {{ currentLogName }}</span>
        <span class="blinking-cursor">█</span>
      </div>
    </div>

    <!-- Barra de Estado Inferior -->
    <div class="terminal-footer">
      <div class="footer-left">
        <span class="stat-badge">Líneas: {{ lines.length }}</span>
        <span v-if="filterQuery" class="stat-badge filter-active">Filtradas: {{ filteredLines.length }}</span>
        <span v-if="isPaused" class="stat-badge paused-badge">PAUSADO</span>
      </div>
      <div class="footer-right">
        <small class="muted-note">WebSocket Bidireccional • Auto-detectado</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  serverName: {
    type: String,
    default: 'motoe20'
  }
});

const emit = defineEmits(['notify']);

const rawSources = ref([]);
const selectedTarget = ref('');
const lines = ref([]);
const connectionStatus = ref('connecting'); // connecting, connected, disconnected
const isPaused = ref(false);
const autoScroll = ref(true);
const isFullscreen = ref(false);
const filterQuery = ref('');
const terminalScroll = ref(null);

let socket = null;
let reconnectTimer = null;
const MAX_LINES_STORED = 800; // límite en memoria para cuidar la RAM del teléfono

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

const statusLabel = computed(() => {
  if (connectionStatus.value === 'connected') return isPaused.value ? 'PAUSADO' : 'EN VIVO';
  if (connectionStatus.value === 'connecting') return 'CONECTANDO';
  return 'OFFLINE';
});

const currentLogName = computed(() => {
  const src = rawSources.value.find((s) => s.id === selectedTarget.value);
  return src ? src.name : selectedTarget.value || 'log';
});

// Agrupar fuentes por categoría (PM2, Archivos de Registro, Sistema Android)
const groupedSources = computed(() => {
  const groups = {};
  for (const src of rawSources.value) {
    const grp = src.group || 'Otros';
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(src);
  }
  return Object.keys(groups).map((name) => ({ name, items: groups[name] }));
});

// Filtrado rápido de líneas (Grep en cliente)
const filteredLines = computed(() => {
  const q = filterQuery.value.trim().toLowerCase();
  if (!q) return lines.value;
  return lines.value.filter((l) => l.toLowerCase().includes(q));
});

// Carga inmediata de fuentes mediante endpoint REST para no esperar al WebSocket
async function fetchSourcesRest() {
  try {
    const res = await fetch('/api/logs/sources');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.sources) && data.sources.length > 0) {
        rawSources.value = data.sources;
        if (!selectedTarget.value || !data.sources.some((s) => s.id === selectedTarget.value)) {
          selectedTarget.value = data.sources[0].id;
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'watch', target: selectedTarget.value }));
          }
        }
      }
    }
  } catch (_) {}
}

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  connectionStatus.value = 'connecting';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${proto}//${window.location.host}/ws/logs`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      connectionStatus.value = 'connected';
      if (selectedTarget.value) {
        socket.send(JSON.stringify({ action: 'watch', target: selectedTarget.value }));
      } else {
        socket.send(JSON.stringify({ action: 'list' }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'sources' && Array.isArray(msg.sources)) {
          rawSources.value = msg.sources;
          const hadTarget = Boolean(selectedTarget.value);
          if ((!selectedTarget.value || !msg.sources.some((s) => s.id === selectedTarget.value)) && msg.sources.length > 0) {
            selectedTarget.value = msg.sources[0].id;
          }
          if (selectedTarget.value && (!hadTarget || selectedTarget.value === msg.sources[0]?.id)) {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ action: 'watch', target: selectedTarget.value }));
            }
          }
        } else if (msg.type === 'history') {
          lines.value = (msg.text || '').split('\n').filter((l) => l.length > 0);
          scrollToBottomIfNeeded();
        } else if (msg.type === 'line' && typeof msg.text === 'string') {
          if (!isPaused.value) {
            lines.value.push(msg.text);
            if (lines.value.length > MAX_LINES_STORED) {
              lines.value.splice(0, lines.value.length - MAX_LINES_STORED);
            }
            scrollToBottomIfNeeded();
          }
        } else if (msg.type === 'cleared') {
          emit('notify', msg.result?.message || 'Log vaciado');
        } else if (msg.type === 'error') {
          emit('notify', msg.message);
        }
      } catch (_) {}
    };

    socket.onclose = () => {
      connectionStatus.value = 'disconnected';
      scheduleReconnect();
    };

    socket.onerror = () => {
      connectionStatus.value = 'disconnected';
    };
  } catch (_) {
    connectionStatus.value = 'disconnected';
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectWebSocket();
  }, 3500);
}

function onTargetChange() {
  lines.value = [];
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action: 'watch', target: selectedTarget.value }));
  }
}

function refreshSourcesList() {
  fetchSourcesRest();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action: 'list' }));
  }
  emit('notify', 'Actualizando lista de fuentes...');
}

function togglePause() {
  isPaused.value = !isPaused.value;
  if (!isPaused.value) {
    scrollToBottomIfNeeded(true);
  }
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value;
  if (autoScroll.value) {
    scrollToBottomIfNeeded(true);
  }
}

function clearScreen() {
  lines.value = [];
  emit('notify', 'Pantalla de terminal limpiada');
}

function confirmFlush() {
  if (!confirm(`¿Seguro que deseas vaciar el archivo de registro en el servidor?`)) return;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action: 'clear', target: selectedTarget.value }));
  }
}

function handleUserScroll() {
  if (!terminalScroll.value) return;
  const el = terminalScroll.value;
  const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 35;
  // Si el usuario sube, pausamos temporalmente el autoscroll para no molestarlo
  autoScroll.value = isAtBottom;
}

function scrollToBottomIfNeeded(force = false) {
  if (!autoScroll.value && !force) return;
  nextTick(() => {
    if (terminalScroll.value) {
      terminalScroll.value.scrollTop = terminalScroll.value.scrollHeight;
    }
  });
}

/**
 * Resaltador de sintaxis para logs de terminal (Colorea errores, advertencias, timestamps y status HTTP)
 */
function highlightLogLine(raw) {
  if (!raw) return '';

  let escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 1. Errores, fallos y excepciones -> Rojo Neón brillante
  escaped = escaped.replace(
    /\b(ERR|ERROR|FATAL|Exception|Error:|failed|FAIL|crash)\b/gi,
    '<span class="hl-err">$1</span>'
  );

  // 2. Advertencias -> Ámbar / Amarillo
  escaped = escaped.replace(
    /\b(WARN|WARNING|warn)\b/gi,
    '<span class="hl-warn">$1</span>'
  );

  // 3. Info / Éxito / 200 OK -> Verde Esmeralda Neón
  escaped = escaped.replace(
    /\b(INF|INFO|SUCCESS|online|OK|200 OK|ready)\b/gi,
    '<span class="hl-info">$1</span>'
  );

  // 4. Códigos de estado HTTP (200, 304, 404, 500)
  escaped = escaped.replace(
    /\b(HTTP\/\d(?:\.\d)?\s+)?(200|201|204|304)\b/g,
    '<span class="hl-http-ok">$1$2</span>'
  );
  escaped = escaped.replace(
    /\b(HTTP\/\d(?:\.\d)?\s+)?(400|401|403|404|500|502|503)\b/g,
    '<span class="hl-http-err">$1$2</span>'
  );

  // 5. Fechas y marcas de tiempo ISO / horas
  escaped = escaped.replace(
    /\b(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\b/g,
    '<span class="hl-timestamp">$1</span>'
  );

  // 6. PIDs de procesos y puertos (ej: PID 13104, :3055)
  escaped = escaped.replace(
    /\b(PID\s+\d+|:\d{4,5})\b/gi,
    '<span class="hl-cyan">$1</span>'
  );

  return escaped;
}

onMounted(() => {
  fetchSourcesRest();
  connectWebSocket();
});

onUnmounted(() => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (socket) {
    try {
      socket.close();
    } catch (_) {}
  }
});
</script>

<style scoped>
.terminal-window {
  background: #030805;
  border: 1px solid #132b1d;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 160px);
  min-height: 560px;
  width: 100%;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  transition: all 0.2s ease;
}

.terminal-window.is-fullscreen {
  position: fixed;
  top: 10px;
  left: 10px;
  right: 10px;
  bottom: 10px;
  height: calc(100vh - 20px) !important;
  max-height: none !important;
  z-index: 9999;
  border-color: var(--neon-green);
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.9);
}

/* Barra de Título */
.terminal-titlebar {
  background: #07130b;
  border-bottom: 1px solid #102619;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.window-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
}

.win-btn {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.win-btn.close { background: #ef4444; }
.win-btn.minimize { background: #f59e0b; }
.win-btn.zoom { background: #10b981; }

.terminal-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: #8b9d93;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.term-icon { color: var(--neon-green); font-size: 0.82rem; }
.term-host { color: #38bdf8; font-weight: 600; }
.term-cmd { color: #d1fae5; }

/* Status Pill */
.terminal-status-wrap {
  display: flex;
  align-items: center;
}

.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  letter-spacing: 0.5px;
}
.live-pill.connected {
  background: rgba(0, 230, 118, 0.12);
  color: var(--neon-green);
  border: 1px solid rgba(0, 230, 118, 0.3);
}
.live-pill.connecting {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}
.live-pill.disconnected {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.pulse-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}

/* Barra de Herramientas */
.terminal-toolbar {
  background: #050e08;
  border-bottom: 1px solid #102619;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-select-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.source-select {
  background: #09170e;
  border: 1px solid #1b3827;
  color: var(--text-white);
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 0.74rem;
  font-family: inherit;
  outline: none;
  max-width: 250px;
  cursor: pointer;
}
.source-select:focus {
  border-color: var(--neon-green);
}
.source-select optgroup {
  background: #07120a;
  color: #38bdf8;
  font-weight: 700;
}
.source-select option {
  background: #09170e;
  color: var(--text-white);
  font-weight: 400;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #09170e;
  border: 1px solid #1b3827;
  border-radius: 6px;
  padding: 4px 8px;
}
.search-icon {
  font-size: 0.7rem;
  opacity: 0.6;
}
.terminal-search-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-white);
  font-size: 0.74rem;
  font-family: inherit;
  width: 140px;
}
.clear-search-btn {
  background: none;
  border: none;
  color: #8b9d93;
  font-size: 0.65rem;
  cursor: pointer;
}

.tool-btn {
  background: #09170e;
  border: 1px solid #1b3827;
  color: #a7f3d0;
  padding: 4px 9px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tool-btn:hover {
  background: rgba(0, 230, 118, 0.15);
  border-color: var(--neon-green);
  color: var(--neon-green);
}
.tool-btn.active {
  background: var(--neon-green);
  color: #04140b;
  border-color: var(--neon-green);
}
.tool-btn.danger {
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}
.tool-btn.danger:hover {
  background: #ef4444;
  color: #ffffff;
}
.tool-btn.icon-btn {
  padding: 4px 6px;
}

.fullscreen-toggle-btn {
  background: rgba(0, 230, 118, 0.08);
  border: 1px solid rgba(0, 230, 118, 0.25);
  color: var(--neon-green);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.fullscreen-toggle-btn:hover {
  background: var(--neon-green);
  color: #04140b;
}

/* Pantalla de Terminal */
.terminal-screen {
  padding: 12px 14px;
  background: #030805;
  overflow-y: auto;
  flex: 1;
  min-height: 250px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #e2e8f0;
  user-select: text;
}

.terminal-empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 0;
}
.empty-comment {
  color: #475569;
  font-style: italic;
}

.terminal-line {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  word-break: break-all;
  white-space: pre-wrap;
}
.terminal-line:hover {
  background: rgba(255, 255, 255, 0.03);
}

.line-number {
  color: #274736;
  font-size: 0.68rem;
  min-width: 28px;
  text-align: right;
  user-select: none;
  flex-shrink: 0;
  padding-top: 1px;
}

.line-content {
  flex: 1;
}

/* Prompt Final */
.terminal-prompt-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
  font-size: 0.78rem;
}
.prompt-user { color: var(--neon-green); font-weight: 700; }
.prompt-sep { color: #8b9d93; }
.prompt-path { color: #38bdf8; font-weight: 700; }
.prompt-char { color: #ffffff; font-weight: 700; }
.prompt-cmd { color: #a7f3d0; margin-left: 2px; }
.blinking-cursor {
  color: var(--neon-green);
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Barra de Estado Inferior */
.terminal-footer {
  background: #050e08;
  border-top: 1px solid #102619;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.68rem;
  color: #64748b;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stat-badge {
  background: rgba(255, 255, 255, 0.05);
  padding: 1px 6px;
  border-radius: 4px;
  color: #cbd5e1;
}
.stat-badge.filter-active {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}
.stat-badge.paused-badge {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  font-weight: 700;
}

.muted-note {
  color: #475569;
}

/* Coloreado Sintáctico (Deep Selector para v-html) */
:deep(.hl-err) {
  color: #f87171 !important;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(239, 68, 68, 0.35);
}
:deep(.hl-warn) {
  color: #fbbf24 !important;
  font-weight: 600;
}
:deep(.hl-info) {
  color: var(--neon-green) !important;
  font-weight: 600;
  text-shadow: 0 0 6px rgba(0, 230, 118, 0.25);
}
:deep(.hl-http-ok) {
  color: #34d399 !important;
  font-weight: 700;
}
:deep(.hl-http-err) {
  color: #ef4444 !important;
  font-weight: 700;
}
:deep(.hl-timestamp) {
  color: #64748b !important;
}
:deep(.hl-cyan) {
  color: #38bdf8 !important;
}

@media (max-width: 768px) {
  .terminal-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .source-select {
    max-width: 160px;
  }
  .terminal-search-input {
    width: 90px;
  }
  .terminal-screen {
    max-height: 400px;
    min-height: 300px;
    font-size: 0.72rem;
  }
}
</style>

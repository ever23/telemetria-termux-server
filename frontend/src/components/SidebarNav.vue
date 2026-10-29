<template>
  <!-- Sidebar Escritorio -->
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-badge">{{ (server.deviceName || 'T').charAt(0).toUpperCase() }}</div>
      <span class="brand-name">{{ server.deviceName || 'TermuxNode' }}</span>
    </div>

    <nav class="nav-list">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-item"
        :class="{ active: activeTab === item.id }"
        @click="$emit('select', item.id)"
      >
        <span class="nav-icon" v-html="item.icon"></span>
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <div class="footer-item">
        <span class="nav-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <span>SSH :{{ server.sshPort || 8022 }} ({{ server.termuxUser || 'termux' }})</span>
      </div>

      <div class="footer-item">
        <span class="nav-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </span>
        <span>{{ server.ip || '127.0.0.1' }}:{{ server.port || 3055 }}</span>
      </div>

      <div class="footer-item status-pill-footer">
        <span class="pulse-dot"></span>
        <span>Servidor en línea</span>
      </div>
    </div>
  </aside>

  <!-- Barra de navegación inferior Móvil (Idéntica a la vista móvil de referencia) -->
  <nav class="mobile-bottom-nav">
    <button
      v-for="item in navItems"
      :key="item.id"
      class="mobile-nav-btn"
      :class="{ active: activeTab === item.id }"
      @click="$emit('select', item.id)"
    >
      <span class="mobile-nav-icon" v-html="item.icon"></span>
      <span class="mobile-nav-label">{{ item.shortLabel }}</span>
    </button>
  </nav>
</template>

<script setup>
defineProps({
  activeTab: { type: String, default: 'dashboard' },
  server: { type: Object, default: () => ({}) }
});

defineEmits(['select']);

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Inicio',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>`
  },
  {
    id: 'pm2',
    label: 'Procesos PM2',
    shortLabel: 'PM2',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`
  },
  {
    id: 'hardware',
    label: 'Hardware & CPU',
    shortLabel: 'Hardware',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
  },
  {
    id: 'screen',
    label: 'Pantalla ADB',
    shortLabel: 'Pantalla',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`
  }
];
</script>

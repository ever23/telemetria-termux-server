<template>
  <div v-if="modelValue" class="qr-modal-backdrop" @click.self="close">
    <div class="qr-modal-card">
      <div class="qr-modal-header">
        <div class="qr-title-box">
          <span class="qr-icon">{{ service?.icon === 'notes' ? '📝' : service?.isTunnel ? '☁️' : '🌐' }}</span>
          <div>
            <h3 class="qr-title">{{ service?.name || 'Servicio Web' }}</h3>
            <span class="qr-port-badge">
              {{ service?.isTunnel ? 'Público HTTPS' : `Puerto ${service?.port} • LAN` }}
            </span>
          </div>
        </div>
        <button class="qr-close-btn" @click="close">✕</button>
      </div>

      <div class="qr-code-body">
        <div class="qr-canvas-wrap">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="Código QR" class="qr-img" />
          <div v-else class="qr-loading">Generando QR...</div>
        </div>

        <div class="qr-url-box">
          <code class="qr-url-text">{{ service?.url }}</code>
          <div class="qr-actions">
            <button class="btn-copy" @click="copyUrl">
              {{ copied ? '¡Copiado!' : 'Copiar URL' }}
            </button>
            <a :href="service?.url" target="_blank" rel="noopener" class="btn-open">
              Abrir ↗
            </a>
          </div>
        </div>

        <p class="qr-hint">
          Escanea con la cámara de tu teléfono, tablet o laptop conectada a la misma red Wi-Fi para acceder al instante.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import QRCode from 'qrcode';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  service: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'notify']);

const qrDataUrl = ref('');
const copied = ref(false);

watch(
  () => props.service,
  async (newService) => {
    if (newService?.url) {
      copied.value = false;
      try {
        qrDataUrl.value = await QRCode.toDataURL(newService.url, {
          width: 220,
          margin: 1,
          color: {
            dark: '#03140a',
            light: '#ffffff'
          }
        });
      } catch (err) {
        console.error('Error generando QR:', err);
      }
    }
  },
  { immediate: true }
);

function close() {
  emit('update:modelValue', false);
}

async function copyUrl() {
  if (!props.service?.url) return;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.service.url);
    } else {
      const el = document.createElement('textarea');
      el.value = props.service.url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    copied.value = true;
    emit('notify', 'URL copiada al portapapeles');
    setTimeout(() => {
      copied.value = false;
    }, 2500);
  } catch (_) {
    emit('notify', 'No se pudo copiar');
  }
}
</script>

<style scoped>
.qr-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.qr-modal-card {
  background: #07100b;
  border: 1.5px solid #00e676;
  border-radius: 16px;
  width: 100%;
  max-width: 320px;
  box-shadow: 0 10px 30px rgba(0, 230, 118, 0.2), 0 20px 40px rgba(0, 0, 0, 0.9);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.qr-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: #0a1811;
  border-bottom: 1px solid #162e22;
}

.qr-title-box {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qr-icon {
  font-size: 1.3rem;
}

.qr-title {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: #ffffff;
}

.qr-port-badge {
  font-size: 0.62rem;
  font-weight: 600;
  color: #00e676;
  background: rgba(0, 230, 118, 0.12);
  padding: 1px 6px;
  border-radius: 999px;
  display: inline-block;
  margin-top: 2px;
}

.qr-close-btn {
  background: transparent;
  border: none;
  color: #8b9d93;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}

.qr-close-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.qr-code-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-canvas-wrap {
  background: #ffffff;
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-img {
  width: 100%;
  height: 100%;
  display: block;
}

.qr-loading {
  color: #333333;
  font-size: 0.8rem;
  font-weight: 600;
}

.qr-url-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qr-url-text {
  background: #040806;
  border: 1px solid #162e22;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.72rem;
  color: #86efac;
  word-break: break-all;
  text-align: center;
  font-family: monospace;
}

.qr-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn-copy, .btn-open {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy {
  background: #0d1a13;
  border: 1px solid #00e676;
  color: #00e676;
}

.btn-copy:hover {
  background: #00e676;
  color: #04140b;
}

.btn-open {
  background: #11251c;
  border: 1px solid #1d4030;
  color: #ffffff;
}

.btn-open:hover {
  background: #1a382b;
}

.qr-hint {
  margin: 0;
  font-size: 0.62rem;
  color: #677b70;
  text-align: center;
  line-height: 1.35;
}
</style>

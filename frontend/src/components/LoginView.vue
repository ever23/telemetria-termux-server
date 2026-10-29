<template>
  <div class="login-screen">
    <form class="login-card" @submit.prevent="submit">
      <div class="login-brand">
        <div class="brand-badge">T</div>
        <span class="brand-name">Termux Telemetry</span>
      </div>

      <h1 class="login-title">Acceso al panel</h1>
      <p class="login-sub">Introduce la contraseña del servidor</p>

      <label class="login-field">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <input
          ref="inputRef"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Contraseña"
          autocomplete="current-password"
          :disabled="loading"
        />
        <button type="button" class="toggle-eye" @click="showPassword = !showPassword">
          {{ showPassword ? 'Ocultar' : 'Ver' }}
        </button>
      </label>

      <p v-if="error" class="login-error">{{ error }}</p>

      <button type="submit" class="login-btn" :disabled="loading || !password">
        {{ loading ? 'Verificando…' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['success']);

const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const error = ref('');
const inputRef = ref(null);

onMounted(() => inputRef.value?.focus());

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      password.value = '';
      emit('success');
    } else {
      error.value = data.error || 'No se pudo iniciar sesión';
    }
  } catch (_) {
    error.value = 'Servidor no disponible';
  } finally {
    loading.value = false;
  }
}
</script>

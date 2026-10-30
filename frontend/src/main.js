import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');

// Registro del Service Worker para soporte PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Chequear actualizaciones periódicas del SW
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Nueva versión de la PWA disponible.');
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn('Error registrando Service Worker PWA:', err);
      });
  });
}

# Releases de Termux Telemetry Launcher

Este directorio contiene las compilaciones APK del Launcher nativo de Android:

- **v0.2**: `termux-telemetry-launcher-v0.2.apk` (5.5 MB)
  - Última compilación local probada e instalada en el Moto E20.
  - Firma local de depuración.

- **v0.1**: `termux-telemetry-launcher-v0.1.apk` (5.5 MB)
  - Compilación inicial generada por GitHub Actions CI/CD.
  - WebView ultra ligera apuntando a `http://127.0.0.1:3055/?launcher=1`.
  - Detección de loopback local para bypass de autenticación automático.
  - Cajón de aplicaciones nativo offline (`AppsBottomSheet.kt`).
  - Navegación horizontal en Vue (`LauncherHomeView.vue`) con scroll-snap (`● ○ ○`) sin pull-to-refresh ni scroll vertical.
  - Gestión de ciclo de vida con suspensión de timers en reposo (`pauseTimers`).

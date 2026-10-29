# Termux Telemetry Launcher (Android 11 Go)

Micro-launcher nativo ultra-liviano (< 1.5 MB APK) en Kotlin diseñado específicamente para convertir un smartphone Android doméstico (como el Motorola Moto E20 con Unisoc T606 y 2 GB RAM) en un monitor de servidor 24/7 sin sacrificar el acceso rápido a las aplicaciones del dispositivo.

---

## Características

1. **Telemetría en Vivo como Pantalla de Inicio:**
   - Embebe un `WebView` de Chromium a pantalla completa apuntando a `http://127.0.0.1:3055/?launcher=1`.
   - **Bypass local transparente:** Accede a todas las métricas, control de pantalla y PM2 sin pedir contraseña.

2. **Lanzador de Apps 100% Offline (App Drawer):**
   - Botón flotante estilo dock `[ 📱 Aplicaciones ]` en la parte inferior.
   - Abre un Bottom Sheet nativo con la lista/grid de todas las aplicaciones instaladas (`PackageManager`) e icono de acceso directo a los Ajustes de Android.

3. **Suspensión Inteligente (Ahorro de Batería y 2 GB RAM):**
   - Cuando la pantalla entra en reposo, `onPause()` invoca `webView.pauseTimers()`, congelando de inmediato la ejecución de JavaScript y el polling de red para no calentar la batería ni consumir memoria innecesaria.

---

## Instalación y Configuración vía ADB

### 1. Compilación
El proyecto se compila automáticamente mediante **GitHub Actions** al hacer push a la rama `master`. Puedes descargar el archivo `app-debug.apk` directamente desde la pestaña **Actions** de GitHub.

### 2. Instalación en el Moto E20
Conecta el teléfono por USB o ADB Wi-Fi e instala el APK:
```bash
adb install -r app-debug.apk
```

### 3. Establecer como Launcher Predeterminado
Puedes seleccionarlo presionando el botón Home físico del teléfono, o forzarlo directamente por comando ADB:
```bash
adb shell cmd package set-home-activity com.termux.telemetry.launcher/.MainActivity
```

### 4. Volver al Launcher Original de Motorola
Si alguna vez deseas regresar al launcher estándar:
- Desde el propio teléfono: toca `[ 📱 Aplicaciones ]` > Icono de Engranaje (Ajustes) > **Apps y notificaciones > Apps predeterminadas > App de inicio** y selecciona el launcher del sistema.
- O por ADB:
```bash
adb shell cmd package set-home-activity com.android.launcher3/.Launcher
```

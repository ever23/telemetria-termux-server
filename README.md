# 📡 Termux Telemetry

Micro-panel web de telemetría **ultra-liviano** para convertir un teléfono Android viejo en un servidor doméstico monitoreable. Corre en **Termux** con Node.js + Express, y su interfaz está hecha con **Vue 3 + Vite** (diseño dark / verde esmeralda, responsive para PC y móvil).

![Node](https://img.shields.io/badge/node-%3E%3D18-00e676) ![Vue](https://img.shields.io/badge/vue-3-00e676) ![License](https://img.shields.io/badge/license-MIT-00e676)

## ✨ Características

- **CPU**: uso total, carga media y gráfico de barras por núcleo.
- **RAM**: usada / disponible / caché (lectura directa de `/proc/meminfo`).
- **Batería**: nivel, temperatura, voltaje y estado de carga.
- **Uptime** del sistema y del propio panel, con la RAM que consume.
- **Procesos PM2** (solo lectura): estado, memoria, CPU, reinicios y uptime.
- **Control de pantalla** vía ADB inalámbrico: encender (`keyevent 224`) / apagar (`keyevent 223`).
- **Historial en vivo** (ring buffer en memoria) con gráfica SVG de CPU / RAM / temperatura.
- **Autodetección** del dispositivo: modelo, SoC, versión de Android, IP, usuario y túnel `localtunnel` (vía `getprop`, `os` y `crontab`). No hay que configurar nada personal.
- Frontend sin librerías de gráficos: todo en SVG nativo (~37 KB gzip).

## 🧱 Requisitos

En el dispositivo Android (Termux):

```bash
pkg update && pkg install nodejs-lts android-tools git
npm install -g pm2
```

- **ADB inalámbrico** activo en el propio teléfono (Opciones de desarrollador → Depuración inalámbrica, o `adb tcpip 5555` desde una PC) y emparejado consigo mismo:
  ```bash
  adb connect 127.0.0.1:5555
  ```
  > Es necesario porque en Android 8+ SELinux bloquea a Termux el acceso a `/proc/stat` y `/sys/class/power_supply`. El usuario `shell` de ADB sí puede leerlos. Sin ADB el panel funciona, pero con datos de CPU/batería limitados y sin control de pantalla.

## 🚀 Instalación (en Termux)

```bash
git clone https://github.com/<tu-usuario>/telemetria-termux-server.git
cd telemetria-termux-server
cp .env.example .env          # opcional: ajusta puerto / host ADB
npm install --omit=dev
chmod +x scripts/screen_control.sh
pm2 start ecosystem.config.js
pm2 save
```

Abre en cualquier navegador de tu red: `http://<IP-del-teléfono>:3055`

> La carpeta `public/` ya viene compilada, **no hace falta compilar el frontend en el teléfono**.

## ⚙️ Configuración (`.env`)

Todas las variables son opcionales. Ver [`.env.example`](.env.example).

| Variable | Default | Descripción |
| --- | --- | --- |
| `PORT` | `3055` | Puerto HTTP del panel |
| `SSH_PORT` | `8022` | Puerto SSH mostrado en el panel |
| `ADB_HOST_LOCAL` | `127.0.0.1:5555` | Host ADB usado cuando corre en Termux |
| `ADB_HOST_REMOTE` | `127.0.0.1:5555` | Host ADB usado cuando corre en Windows (desarrollo) |
| `POWER_SOURCE` | `5V UPS` | Etiqueta de la fuente de energía |
| `HISTORY_MAX_POINTS` | `20` | Puntos guardados en el historial |
| `CACHE_TTL_MS` | `2000` | Caché de lecturas ADB |
| `DEVICE_NAME`, `SOC_NAME`, `OS_NAME`, `SERVER_IP`, `TERMUX_USER`, `TUNNEL_URL` | *autodetectado* | Sobrescriben la autodetección |

## 🛠️ Desarrollo (en PC)

```bash
npm install
npm --prefix frontend install

npm run dev                     # backend en :3055
npm --prefix frontend run dev   # Vite en :5173 con proxy /api → :3055
npm run build:ui                # compila el frontend hacia public/
```

En Windows puedes apuntar al ADB del teléfono definiendo `ADB_HOST_REMOTE=<IP-del-teléfono>:5555` en `.env`. Sin conexión ADB, el backend usa valores de respaldo para que la UI siga siendo navegable.

## 🔌 API

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/telemetry` | Paquete completo: servidor, CPU, RAM, batería, pantalla, uptime, PM2 e historial |
| `GET` | `/api/pm2` | Lista de procesos PM2 |
| `POST` | `/api/screen/on` | Enciende la pantalla |
| `POST` | `/api/screen/off` | Apaga la pantalla |

> ⚠️ La API no tiene autenticación: está pensada para **red local**. No la expongas a Internet (túnel, port-forwarding) sin poner un proxy con auth delante.

## 📁 Estructura

```
├── server.js               # Express + API + estáticos
├── ecosystem.config.js     # Perfil PM2 (límite de memoria)
├── lib/
│   ├── config.js           # Carga de .env (sin dependencias)
│   ├── discovery.js        # Autodetección del dispositivo
│   ├── adb.js              # Puente ADB y control de pantalla
│   ├── system.js           # CPU, RAM, uptime
│   ├── battery.js          # Batería (sysfs / dumpsys)
│   └── pm2.js              # pm2 jlist
├── scripts/screen_control.sh
├── public/                 # Frontend compilado (generado por Vite)
└── frontend/               # Código fuente Vue 3 + Vite
```

## 📄 Licencia

MIT

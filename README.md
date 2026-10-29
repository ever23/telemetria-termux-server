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

En el dispositivo Android (dentro de Termux):

```bash
pkg update && pkg install nodejs-lts android-tools git
npm install -g pm2
```

> **¿Por qué `android-tools`?**  
> Instala el comando `adb` directamente **dentro de Termux**. Esto permite que el servidor Node.js se comunique con el teléfono a través de `127.0.0.1:5555` con permisos de sistema (`uid=shell/2000`).  
> En Android 8+ (incluido Android 11 Go), SELinux bloquea a Termux el acceso directo a `/proc/stat` y `/sys/class/power_supply/battery`. A través de ADB local, el panel puede leer `dumpsys battery`, `dumpsys power` y encender/apagar la pantalla con `input keyevent` sin requerir root.

- **ADB inalámbrico** activo en el propio teléfono (Opciones de desarrollador → Depuración inalámbrica en Android 11+, o activado una vez desde PC vía `adb tcpip 5555`) y conectado a sí mismo en Termux:
  ```bash
  adb connect 127.0.0.1:5555
  ```

## 🚀 Instalación (en Termux)

```bash
git clone https://github.com/ever23/telemetria-termux-server.git
cd telemetria-termux-server
cp .env.example .env          # opcional: ajusta puerto / host ADB
npm install --omit=dev
chmod +x scripts/screen_control.sh
npm run set-password          # define la contraseña de acceso (recomendado)
pm2 start ecosystem.config.js
pm2 save
```

Abre en cualquier navegador de tu red: `http://<IP-del-teléfono>:3055`

> La carpeta `public/` ya viene compilada, **no hace falta compilar el frontend en el teléfono**.

## 🔐 Control de acceso

El panel se protege con una **contraseña única**:

```bash
npm run set-password          # pide la contraseña (oculta) dos veces
pm2 restart termux-telemetry  # aplica el cambio
```

- En `.env` solo se guarda el **hash** (`AUTH_PASSWORD_HASH`), calculado con `scrypt` y un salt aleatorio. La contraseña en texto plano no se guarda en ningún sitio. `.env` queda con permisos `600`.
- Al iniciar sesión se entrega una cookie `HttpOnly` y `SameSite=Strict` firmada con HMAC (`SESSION_SECRET`, que se genera solo). Dura `SESSION_DAYS` días (7 por defecto).
- Si cambias la contraseña, se cierran todas las sesiones abiertas.
- Tras 5 intentos fallidos, la IP queda bloqueada 15 minutos.
- **Sin contraseña configurada**, el panel funciona en solo lectura y el control de pantalla queda bloqueado.

> ⚠️ El panel usa HTTP, así que la contraseña viaja sin cifrar por tu red local al iniciar sesión. En una red doméstica de confianza es aceptable. Si lo expones a Internet, hazlo solo a través de un túnel o proxy **HTTPS**.

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
| `AUTH_PASSWORD_HASH` | — | Hash de la contraseña (generado por `npm run set-password`) |
| `SESSION_SECRET` | *autogenerado* | Clave para firmar las cookies de sesión |
| `SESSION_DAYS` | `7` | Duración de la sesión |
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

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/auth/status` | — | `{ configured, authenticated }` |
| `POST` | `/api/auth/login` | — | `{ password }` → cookie de sesión |
| `POST` | `/api/auth/logout` | — | Cierra la sesión |
| `GET` | `/api/telemetry` | ✅* | Paquete completo: servidor, CPU, RAM, batería, pantalla, uptime, PM2 e historial |
| `GET` | `/api/pm2` | ✅* | Lista de procesos PM2 |
| `POST` | `/api/screen/on` | ✅ | Enciende la pantalla |
| `POST` | `/api/screen/off` | ✅ | Apaga la pantalla |

\* Si no hay contraseña configurada, se permite la lectura sin sesión. El control de pantalla siempre exige sesión.

## 📁 Estructura

```
├── server.js               # Express + API + estáticos
├── ecosystem.config.js     # Perfil PM2 (límite de memoria)
├── lib/
│   ├── config.js           # Carga de .env (sin dependencias)
│   ├── envfile.js          # Escritura segura de .env (chmod 600)
│   ├── auth.js             # Hash scrypt, sesión firmada, anti fuerza bruta
│   ├── discovery.js        # Autodetección del dispositivo
│   ├── adb.js              # Puente ADB y control de pantalla
│   ├── system.js           # CPU, RAM, uptime
│   ├── battery.js          # Batería (sysfs / dumpsys)
│   └── pm2.js              # pm2 jlist
├── scripts/
│   ├── screen_control.sh   # Puente ADB (pantalla + dumpsys)
│   └── set-password.js     # Define la contraseña de acceso
├── public/                 # Frontend compilado (generado por Vite)
└── frontend/               # Código fuente Vue 3 + Vite
```

## 📄 Licencia

MIT

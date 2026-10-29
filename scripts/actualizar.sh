#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# actualizar.sh - Sincroniza desde GitHub y reinicia termux-telemetry
# =============================================================================

set -e

# Asegurar ruta del proyecto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "=========================================="
echo " [Termux Telemetry] Actualizando servidor "
echo "=========================================="
echo "Directorio: $PROJECT_DIR"
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. Obtener cambios remotos
echo "-> Descargando cambios desde GitHub..."
git pull origin master

# 2. Instalar dependencias si hubo cambios en package.json
echo "-> Verificando dependencias npm..."
npm install --omit=dev --no-audit --no-fund

# 3. Permisos de scripts
echo "-> Asegurando permisos de ejecucion..."
chmod +x scripts/*.sh 2>/dev/null || true

# 4. Reiniciar proceso en PM2
echo "-> Reiniciando servicio en PM2..."
if pm2 describe termux-telemetry >/dev/null 2>&1; then
  pm2 restart termux-telemetry
else
  pm2 start ecosystem.config.js
fi

pm2 save

echo ""
echo "=========================================="
echo " ✔ Servidor actualizado y en linea"
echo "=========================================="
pm2 status termux-telemetry

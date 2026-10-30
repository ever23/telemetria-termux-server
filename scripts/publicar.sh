#!/usr/bin/env bash
# ==============================================================================
# publicar.sh - Publicar nuevo Release y compilar APK en GitHub Actions
# ==============================================================================
set -e

echo "=== Publicador de Releases para Termux Telemetry ==="

# 1. Obtener el tag de versión (por parámetro o interactivo)
TAG="$1"
if [ -z "$TAG" ]; then
  # Buscar el último tag existente
  ULTIMO_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "ninguno")
  echo "Último tag registrado: $ULTIMO_TAG"
  echo ""
  read -r -p "Ingrese la nueva versión (ej: v0.3): " TAG
fi

# Validar que no esté vacío
if [ -z "$TAG" ]; then
  echo "Error: Debe indicar una versión válida (ej: v0.3)."
  exit 1
fi

# Asegurar formato con prefijo 'v'
if [[ ! "$TAG" =~ ^v ]]; then
  TAG="v$TAG"
fi

# Verificar si el tag ya existe localmente o en remoto
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: El tag '$TAG' ya existe localmente."
  exit 1
fi

# 2. Comprobar estado del repositorio
if [ -n "$(git status --porcelain)" ]; then
  echo ""
  echo "Tienes cambios locales sin commitear:"
  git status -s
  echo ""
  read -r -p "¿Deseas hacer commit de estos cambios antes de publicar? (s/N): " CONFIRM_COMMIT
  if [[ "$CONFIRM_COMMIT" =~ ^[sSyY]$ ]]; then
    read -r -p "Mensaje del commit: " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
      COMMIT_MSG="chore(release): preparar lanzamiento $TAG"
    fi
    git add -A
    git commit -m "$COMMIT_MSG"
  else
    echo "Operación cancelada. Haz commit o stash de tus cambios primero."
    exit 1
  fi
fi

# 3. Crear el Tag de Git
echo ""
echo "-> Creando tag '$TAG'..."
git tag -a "$TAG" -m "Release $TAG"

# 4. Enviar a GitHub (rama master y tag)
echo "-> Enviando rama master y tag a GitHub..."
git push origin master
git push origin "$TAG"

echo ""
echo "=================================================================="
echo " ¡Tag $TAG publicado exitosamente en GitHub!"
echo " GitHub Actions ha iniciado la compilación automática del APK."
echo ""
echo " Monitorear compilación:"
echo " https://github.com/ever23/telemetria-termux-server/actions"
echo ""
echo " Descargar el nuevo APK cuando termine (en 1-2 minutos):"
echo " https://github.com/ever23/telemetria-termux-server/releases/tag/$TAG"
echo "=================================================================="

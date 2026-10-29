#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# screen_control.sh - Control de pantalla y puente de telemetría ADB (Termux)
# Uso: ./scripts/screen_control.sh [on|off|status|telemetry] [adb_host]
# =============================================================================

ACTION="${1:-status}"
ADB_HOST="${2:-127.0.0.1:5555}"

ensure_adb() {
  if ! adb devices 2>/dev/null | grep -q "$ADB_HOST"; then
    adb connect "$ADB_HOST" >/dev/null 2>&1
  fi
}

case "$ACTION" in
  on|wake)
    ensure_adb
    adb -s "$ADB_HOST" shell input keyevent 224
    echo '{"ok":true,"screen":"ON","action":"keyevent_224"}'
    ;;

  off|sleep)
    ensure_adb
    adb -s "$ADB_HOST" shell input keyevent 223
    echo '{"ok":true,"screen":"OFF","action":"keyevent_223"}'
    ;;

  status)
    ensure_adb
    RAW=$(adb -s "$ADB_HOST" shell "dumpsys power | grep -E 'mWakefulness=|Display Power:'" 2>/dev/null | tr '\r' ' ')
    if echo "$RAW" | grep -Eqi "Awake|state=ON"; then
      echo '{"ok":true,"screen":"ON"}'
    elif echo "$RAW" | grep -Eqi "Asleep|Dozing|state=OFF"; then
      echo '{"ok":true,"screen":"OFF"}'
    else
      echo '{"ok":false,"screen":"UNKNOWN"}'
    fi
    ;;

  telemetry)
    ensure_adb
    adb -s "$ADB_HOST" shell "
      echo '===BATTERY==='
      dumpsys battery 2>/dev/null
      echo '===POWER==='
      dumpsys power 2>/dev/null | grep -E 'mWakefulness=|Display Power:'
      echo '===STAT==='
      head -n 9 /proc/stat 2>/dev/null
      echo '===LOADAVG==='
      cat /proc/loadavg 2>/dev/null
    " 2>/dev/null
    ;;

  *)
    echo '{"ok":false,"error":"Accion no valida. Usa: on | off | status | telemetry"}'
    exit 1
    ;;
esac

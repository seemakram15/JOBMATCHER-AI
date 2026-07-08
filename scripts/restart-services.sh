#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PORT="${APP_PORT:-3002}"
NODE_VERSION="${NODE_VERSION:-22.13.1}"
LOG_FILE="${LOG_FILE:-/tmp/jobmatcher-dev-${APP_PORT}.log}"
PID_FILE="${PID_FILE:-/tmp/jobmatcher-dev-${APP_PORT}.pid}"
HEALTH_URL="http://localhost:${APP_PORT}/auth?mode=signin"
DETACHED="${JOBMATCHER_DETACHED:-0}"

cd "$ROOT_DIR"

load_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    unset npm_config_prefix
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    nvm install "$NODE_VERSION" >/dev/null 2>&1
    nvm use "$NODE_VERSION" >/dev/null
    return
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "Node is not available. Install nvm or Node ${NODE_VERSION} first." >&2
    exit 1
  fi
}

kill_if_running() {
  local pid
  for pid in "$@"; do
    [ -n "${pid:-}" ] || continue
    kill "$pid" 2>/dev/null || true
  done
}

stop_local_services() {
  local port_pids pattern_pids
  port_pids="$(lsof -ti "tcp:${APP_PORT}" 2>/dev/null || true)"
  pattern_pids="$(pgrep -f "vite .*--port ${APP_PORT}|vite.*--port ${APP_PORT}|npm run dev.*--port ${APP_PORT}" 2>/dev/null || true)"

  if [ -n "$port_pids$pattern_pids" ]; then
    kill_if_running $port_pids $pattern_pids
    sleep 1
  fi

  port_pids="$(lsof -ti "tcp:${APP_PORT}" 2>/dev/null || true)"
  pattern_pids="$(pgrep -f "vite .*--port ${APP_PORT}|vite.*--port ${APP_PORT}|npm run dev.*--port ${APP_PORT}" 2>/dev/null || true)"
  if [ -n "$port_pids$pattern_pids" ]; then
    kill -9 $port_pids $pattern_pids 2>/dev/null || true
    sleep 1
  fi
}

start_app() {
  : > "$LOG_FILE"
  {
    echo "=== restarted $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
    echo "node $(node -v)"
    echo "npm $(npm -v)"
  } >> "$LOG_FILE"
  nohup npm run dev -- --host 0.0.0.0 --port "$APP_PORT" --strictPort --force >> "$LOG_FILE" 2>&1 &
  echo "$!" > "$PID_FILE"
}

run_app_foreground() {
  : > "$LOG_FILE"
  echo "$$" > "$PID_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1

  echo "=== restarted $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
  echo "node $(node -v)"
  echo "npm $(npm -v)"
  echo "App: http://localhost:${APP_PORT}/"
  echo "Logs: ${LOG_FILE}"
  echo "Press Ctrl+C to stop Jobmatcher."
  echo

  npm run dev -- --host 0.0.0.0 --port "$APP_PORT" --strictPort --force
}

wait_for_app() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl -fsS "$HEALTH_URL" >/tmp/jobmatcher-health-check.html 2>/dev/null; then
      return 0
    fi
    sleep 1
  done

  echo "Jobmatcher did not become ready on ${HEALTH_URL}." >&2
  echo "Last log lines:" >&2
  tail -n 80 "$LOG_FILE" >&2 || true
  exit 1
}

load_node
stop_local_services

if [ "$DETACHED" = "1" ]; then
  start_app
  wait_for_app

  echo "Jobmatcher services restarted."
  echo "Node: $(node -v)"
  echo "App: http://localhost:${APP_PORT}/"
  echo "Health: ${HEALTH_URL}"
  echo "PID file: ${PID_FILE}"
  echo "Log: ${LOG_FILE}"
else
  run_app_foreground
fi

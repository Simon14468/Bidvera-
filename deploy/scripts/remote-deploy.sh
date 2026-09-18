#!/usr/bin/env bash
# Bidvera remote deploy entrypoint — runs ON the VPS as user bidvera (or via sudo -u bidvera).
# Invoked by GitHub Actions over SSH after CI gates pass.
#
# Required env (from /etc/bidvera/env + caller):
#   DEPLOY_ROOT=/opt/bidvera
#   DEPLOY_ENV=staging|production
#   DEPLOY_SHA=<git sha>
#   APP_PORTS="3000 3001 3002"   # space-separated; single port = controlled restart (downtime risk)
#
# NEVER pass DATABASE_URL / AUTH_SECRET on the CLI — they live only in /etc/bidvera/env.
set -euo pipefail

umask 027

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/bidvera}"
DEPLOY_ENV="${DEPLOY_ENV:-staging}"
DEPLOY_SHA="${DEPLOY_SHA:?DEPLOY_SHA required}"
APP_PORTS="${APP_PORTS:-3000 3001 3002}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/bidvera}"
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-90}"
DRAIN_SEC="${DRAIN_SEC:-5}"
RELEASES_DIR="${DEPLOY_ROOT}/releases"
RELEASE_DIR="${RELEASES_DIR}/${DEPLOY_SHA}"
CURRENT_LINK="${DEPLOY_ROOT}/current"
PREVIOUS_LINK="${DEPLOY_ROOT}/previous"
LOCK_FILE="/var/lock/bidvera-deploy.lock"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() {
  # Never echo secrets — only operational fields.
  echo "[bidvera-deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

die() {
  log "ERROR: $*"
  exit 1
}

# Refuse destructive data ops in this process tree.
assert_no_destructive_cli() {
  local joined="$*"
  echo "$joined" | grep -Eiq 'migrate[[:space:]]+reset|db[[:space:]]+push[[:space:]]+--force-reset|DROP[[:space:]]+DATABASE|TRUNCATE[[:space:]]|DELETE[[:space:]]+FROM[[:space:]]+"?Company|DELETE[[:space:]]+FROM[[:space:]]+"?User' \
    && die "refused destructive command pattern"
}

acquire_lock() {
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    die "another deployment holds $LOCK_FILE — concurrency lock active"
  fi
  echo "$$ ${DEPLOY_SHA} ${DEPLOY_ENV}" >&9
}

require_persistent_roots() {
  [[ -f /etc/bidvera/env ]] || die "/etc/bidvera/env missing"
  set -a
  # shellcheck disable=SC1091
  # Secrets stay in this file — never cat or echo it.
  source /etc/bidvera/env
  set +a
  [[ -n "${STORAGE_ROOT:-}" ]] || die "STORAGE_ROOT unset"
  [[ -n "${BACKUP_ROOT:-}" ]] || die "BACKUP_ROOT unset"
  [[ "$STORAGE_ROOT" != "$BACKUP_ROOT" ]] || die "STORAGE_ROOT must not equal BACKUP_ROOT"
  [[ -d "$STORAGE_ROOT" ]] || die "STORAGE_ROOT does not exist"
  [[ -d "$BACKUP_ROOT" ]] || die "BACKUP_ROOT does not exist"
  case "$RELEASE_DIR" in
    "$STORAGE_ROOT"*|"$BACKUP_ROOT"*) die "release path collides with persistent storage" ;;
  esac
}

health_ok() {
  local port="$1"
  local url="http://127.0.0.1:${port}/api/health"
  local ready="http://127.0.0.1:${port}/api/ready"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SEC))
  while (( SECONDS < deadline )); do
    if curl -sf --max-time 5 "$url" | grep -q '"ok":true' \
      && curl -sf --max-time 10 "$ready" | grep -q '"ready":true'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

nginx_set_instance() {
  # $1=port $2=enable|disable — comment/uncomment upstream server line for this port.
  local port="$1" mode="$2"
  [[ -f "$NGINX_SITE" ]] || { log "WARN: nginx site missing at $NGINX_SITE — skip upstream drain"; return 0; }
  if [[ "$mode" == "disable" ]]; then
    sudo sed -i -E "s|^([[:space:]]*server 127\\.0\\.0\\.1:${port}[[:space:]].*;)|# bidvera-drain \\1|" "$NGINX_SITE" || true
  else
    sudo sed -i -E "s|^# bidvera-drain ([[:space:]]*server 127\\.0\\.0\\.1:${port}[[:space:]].*;)|\1|" "$NGINX_SITE" || true
  fi
  sudo nginx -t
  sudo systemctl reload nginx
}

restart_instance() {
  local port="$1"
  if systemctl list-unit-files | grep -q 'bidvera-app@.service'; then
    sudo systemctl restart "bidvera-app@${port}"
  elif [[ "$port" == "3000" ]] && systemctl list-unit-files | grep -q 'bidvera-app.service'; then
    sudo systemctl restart bidvera-app
  else
    die "no systemd unit for port $port"
  fi
}

rollback_code() {
  log "CODE ROLLBACK: restoring previous symlink (database NOT rolled back)"
  if [[ -L "$PREVIOUS_LINK" ]]; then
    ln -sfn "$(readlink -f "$PREVIOUS_LINK")" "$CURRENT_LINK"
    for port in $APP_PORTS; do
      nginx_set_instance "$port" enable || true
      restart_instance "$port" || true
    done
    sudo systemctl restart bidvera-worker || true
  else
    log "WARN: no previous release symlink — cannot auto-rollback code"
  fi
}

main() {
  assert_no_destructive_cli "$@"
  acquire_lock
  require_persistent_roots

  [[ -d "$RELEASE_DIR" ]] || die "release missing: $RELEASE_DIR (upload/build before remote-deploy)"

  log "env=${DEPLOY_ENV} sha=${DEPLOY_SHA} ports=${APP_PORTS}"

  cd "$RELEASE_DIR"
  bash "${SCRIPT_DIR}/migration-safety-scan.sh" || die "migration safety scan failed"

  log "backup gate starting"
  set -a
  # shellcheck disable=SC1091
  source /etc/bidvera/env
  set +a
  npx tsx scripts/deploy-backup-gate.ts || die "backup gate failed — refusing migrate"

  local mig_before mig_after
  mig_before="$(npx prisma migrate status 2>/dev/null | tail -n 20 | tr '\n' ' ' | cut -c1-200 || true)"
  log "migrate status (pre): ${mig_before}"

  log "prisma migrate deploy (forward-only)"
  npx prisma migrate deploy || die "migrate deploy failed — code not switched; DB may be partially migrated (NO auto DB rollback)"

  mig_after="$(npx prisma migrate status 2>/dev/null | tail -n 5 | tr '\n' ' ' | cut -c1-200 || true)"
  log "migrate status (post): ${mig_after}"

  # Point current → new release (apps still on old process until restart)
  if [[ -L "$CURRENT_LINK" ]]; then
    ln -sfn "$(readlink -f "$CURRENT_LINK")" "$PREVIOUS_LINK"
  fi
  ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

  local port_count=0
  for _ in $APP_PORTS; do port_count=$((port_count + 1)); done
  if [[ "$port_count" -eq 1 ]]; then
    log "WARN: single app instance — controlled restart will cause brief downtime"
  fi

  local failed=0
  for port in $APP_PORTS; do
    log "rolling: drain port ${port}"
    nginx_set_instance "$port" disable
    sleep "$DRAIN_SEC"
    # Units use WorkingDirectory=/opt/bidvera — ensure that is the current symlink root
    # Operators should set WorkingDirectory=/opt/bidvera/current in units when using releases/.
    restart_instance "$port"
    if ! health_ok "$port"; then
      log "health FAILED on port ${port} — stopping rollout"
      failed=1
      nginx_set_instance "$port" enable || true
      break
    fi
    nginx_set_instance "$port" enable
    log "rolling: port ${port} healthy and back in upstream"
  done

  if [[ "$failed" -ne 0 ]]; then
    rollback_code
    die "rollout aborted after health failure — previous code restored where possible"
  fi

  log "restart worker"
  sudo systemctl restart bidvera-worker
  sleep 3
  sudo systemctl is-active --quiet bidvera-worker || die "worker failed to start"

  # Keep last 5 releases
  if [[ -d "$RELEASES_DIR" ]]; then
    ls -1dt "${RELEASES_DIR}"/* 2>/dev/null | tail -n +6 | xargs -r rm -rf --
  fi

  log "SUCCESS sha=${DEPLOY_SHA}"
}

main "$@"

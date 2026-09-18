#!/usr/bin/env bash
# Prepare a release directory on the VPS (git fetch + npm ci + build).
# Does not migrate or restart. Called before remote-deploy.sh.
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/bidvera}"
DEPLOY_SHA="${DEPLOY_SHA:?DEPLOY_SHA required}"
REPO_URL="${REPO_URL:?REPO_URL required}"  # https://github.com/org/bidvera.git (read-only deploy key or token via GIT_ASKPASS)
RELEASES_DIR="${DEPLOY_ROOT}/releases"
RELEASE_DIR="${RELEASES_DIR}/${DEPLOY_SHA}"
GIT_DIR="${DEPLOY_ROOT}/repo.git"

log() { echo "[bidvera-prepare $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
die() { log "ERROR: $*"; exit 1; }

mkdir -p "$RELEASES_DIR"

if [[ ! -d "$GIT_DIR" ]]; then
  log "cloning bare mirror"
  git clone --mirror "$REPO_URL" "$GIT_DIR"
else
  log "fetching"
  git -C "$GIT_DIR" fetch --prune origin
fi

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
git --git-dir="$GIT_DIR" --work-tree="$RELEASE_DIR" checkout -f "$DEPLOY_SHA"
git --git-dir="$GIT_DIR" --work-tree="$RELEASE_DIR" submodule update --init --recursive 2>/dev/null || true

cd "$RELEASE_DIR"
# Refuse if checkout somehow includes local .env with secrets into logs — never cat env files
[[ ! -f .env ]] || log "WARN: .env present in tree — ensure it is gitignored and unused (VPS uses /etc/bidvera/env)"

export NODE_ENV=production
# Load only non-secret build hints if needed; runtime secrets stay in systemd EnvironmentFile
log "npm ci"
npm ci
# prisma generate via postinstall
log "npm run build"
npm run build

log "prepared $RELEASE_DIR"

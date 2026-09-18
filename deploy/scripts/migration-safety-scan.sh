#!/usr/bin/env bash
# Scan Prisma migration SQL for patterns that must NOT auto-deploy.
# Allows DROP CONSTRAINT / DROP INDEX (common Prisma FK recreates).
# Exit 0 = safe; Exit 2 = requires manual operator approval.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIG_DIR="${ROOT}/prisma/migrations"

if [[ ! -d "$MIG_DIR" ]]; then
  echo "migration-safety: no prisma/migrations directory — refuse"
  exit 2
fi

hits=0
deny_file() {
  local f="$1"
  if grep -Eiq \
    -e 'DROP[[:space:]]+TABLE' \
    -e 'DROP[[:space:]]+COLUMN' \
    -e 'DROP[[:space:]]+DATABASE' \
    -e 'TRUNCATE[[:space:]]+(TABLE[[:space:]]+)?' \
    -e 'RENAME[[:space:]]+COLUMN' \
    -e 'ALTER[[:space:]]+TABLE.{0,120}RENAME[[:space:]]+TO' \
    -e 'SET[[:space:]]+NOT[[:space:]]+NULL' \
    "$f"; then
    return 0
  fi
  # DELETE FROM without WHERE on same line / nearby — simple heuristic
  if grep -Eiq 'DELETE[[:space:]]+FROM' "$f" && ! grep -Eiq 'DELETE[[:space:]]+FROM.+WHERE' "$f"; then
    return 0
  fi
  return 1
}

while IFS= read -r -d '' f; do
  if deny_file "$f"; then
    echo "migration-safety: BLOCKED pattern in: ${f#"$ROOT"/}"
    hits=$((hits + 1))
  fi
done < <(find "$MIG_DIR" -type f -name '*.sql' -print0)

for f in "${ROOT}/deploy/scripts"/*.sh "${ROOT}/.github/workflows"/*.yml; do
  [[ -f "$f" ]] || continue
  if grep -Eiq 'migrate[[:space:]]+reset|db[[:space:]]+push[[:space:]]+--force-reset|DROP[[:space:]]+DATABASE|prisma[[:space:]]+db[[:space:]]+push[[:space:]]+--accept-data-loss' "$f"; then
    echo "migration-safety: BLOCKED dangerous command reference in: ${f#"$ROOT"/}"
    hits=$((hits + 1))
  fi
done

if [[ "$hits" -gt 0 ]]; then
  echo "migration-safety: FAIL ($hits issue(s)). Manual operator approval required."
  exit 2
fi

echo "migration-safety: OK"
exit 0

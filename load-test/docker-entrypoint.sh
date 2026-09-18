#!/bin/sh
set -eu

ROLE="${LOAD_TEST_ROLE:-app}"

echo "[load-test] role=$ROLE"

if [ "$ROLE" = "seed" ]; then
  echo "[load-test] applying schema..."
  npx prisma db push --skip-generate
  echo "[load-test] seeding platform + synthetic users..."
  npx tsx prisma/seed.ts
  npx tsx scripts/load-test-seed.ts
  echo "[load-test] seed complete"
  exit 0
fi

if [ "$ROLE" = "worker" ]; then
  echo "[load-test] starting worker..."
  exec npx tsx src/worker/index.ts
fi

# app role — schema/seed handled by dedicated seed service in multi-instance
if [ "${LOAD_TEST_SKIP_SEED:-0}" != "1" ]; then
  echo "[load-test] applying schema..."
  npx prisma db push --skip-generate

  USERS_OUT="${LOAD_TEST_USERS_OUT:-/app/.data/load-test/users.json}"
  NEED_SEED=1
  if [ -f "$USERS_OUT" ]; then
    COUNT="$(node -e "try{const u=require(process.argv[1]);process.stdout.write(String(u.count||u.users?.length||0))}catch{process.stdout.write('0')}" "$USERS_OUT")"
    TARGET="${LOAD_TEST_USER_COUNT:-1000}"
    if [ "$COUNT" -ge "$TARGET" ] 2>/dev/null; then
      echo "[load-test] reuse existing $COUNT synthetic users ($USERS_OUT)"
      NEED_SEED=0
    fi
  fi

  if [ "$NEED_SEED" = "1" ]; then
    echo "[load-test] seeding platform + synthetic users..."
    npx tsx prisma/seed.ts
    npx tsx scripts/load-test-seed.ts
  fi
fi

PORT_NUM="${PORT:-3000}"
echo "[load-test] starting Next.js on :$PORT_NUM (INSTANCE_ID=${INSTANCE_ID:-unset})..."
exec npx next start -H 0.0.0.0 -p "$PORT_NUM"

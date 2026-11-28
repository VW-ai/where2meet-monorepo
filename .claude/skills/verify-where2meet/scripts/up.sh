#!/usr/bin/env bash
# Starts Postgres, Redis, the API and the client from this checkout, then waits until each is usable.
# Usage: scripts/up.sh. Ports come from W2M_API_PORT, W2M_WEB_PORT, W2M_PG_PORT, W2M_REDIS_PORT.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

fail() {
  echo "up: $*" >&2
  [ -z "${started:-}" ] || echo "up: run scripts/down.sh to clear the partial start" >&2
  exit 1
}

for tool in docker node npm curl lsof git perl; do
  command -v "$tool" >/dev/null || fail "missing $tool on PATH"
done
docker info >/dev/null 2>&1 || fail "the Docker daemon is not running"

for other in "$ROOT"/run-*/repo; do
  [ -f "$other" ] || continue
  if [ "$(cat "$other")" = "$REPO" ] && [ "$(dirname "$other")" != "$RUN" ]; then
    fail "this checkout already runs an instance ($(dirname "$other")). Next allows one dev server per client directory, so start a second instance from another git worktree."
  fi
done
if [ -d "$RUN" ]; then
  fail "$RUN exists. Run scripts/doctor.sh to check that instance, or scripts/down.sh first."
fi
for port in "$API_PORT" "$WEB_PORT" "$PG_PORT" "$REDIS_PORT"; do
  owner="$(port_owner "$port")"
  [ -z "$owner" ] || fail "port $port is taken by $owner. Stop it, or shift ports with W2M_*_PORT."
done

mkdir -p "$RUN" "$LOGS" "$EVIDENCE"
started=1
echo "$REPO" > "$RUN/repo"
cat > "$RUN/ports.yml" <<EOF
services:
  postgres:
    ports: !override ["$PG_PORT:5432"]
  redis:
    ports: !override ["$REDIS_PORT:6379"]
EOF

echo "up: starting Postgres on $PG_PORT and Redis on $REDIS_PORT (compose project $PROJECT)"
compose up -d --wait >"$LOGS/compose-$API_PORT.log" 2>&1 || fail "docker compose failed, see $LOGS/compose-$API_PORT.log"

for pkg in server client; do
  if [ ! -f "$REPO/$pkg/node_modules/.package-lock.json" ] ||
    [ "$REPO/$pkg/package-lock.json" -nt "$REPO/$pkg/node_modules/.package-lock.json" ]; then
    echo "up: npm ci in $pkg"
    (cd "$REPO/$pkg" && npm ci --no-audit --no-fund >"$LOGS/npm-ci-$pkg-$API_PORT.log" 2>&1) ||
      fail "npm ci failed in $pkg, see $LOGS/npm-ci-$pkg-$API_PORT.log"
  fi
done

echo "up: generating the Prisma client and applying migrations"
(cd "$REPO/server" && export DATABASE_URL="$DATABASE_URL" && npx prisma generate && npx prisma migrate deploy) \
  >"$LOGS/prisma-$API_PORT.log" 2>&1 || fail "prisma failed, see $LOGS/prisma-$API_PORT.log"

secrets=()
if [ "${W2M_DOPPLER:-1}" = 1 ] && command -v doppler >/dev/null &&
  doppler run --project where2meet-ios --config prd -- sh -c 'test -n "$GOOGLE_MAPS_WEB_API_KEY"' >/dev/null 2>&1; then
  secrets=(doppler run --project where2meet-ios --config prd --)
  echo "maps" > "$RUN/maps"
  echo "up: Maps key comes from Doppler (where2meet-ios/prd), into the process env only"
else
  echo "up: no Maps key. Doppler is missing, signed out, or W2M_DOPPLER=0. Address search and venue search will fail."
fi

start() {
  local name="$1" dir="$2"
  shift 2
  (
    cd "$dir"
    nohup perl -e 'use POSIX "setsid"; setsid(); exec @ARGV or die "exec: $!"' -- "$@" \
      >"$LOGS/$name-$API_PORT.log" 2>&1 </dev/null &
    echo $! >"$RUN/$name.pid"
  )
}

echo "up: starting the API on $API_PORT"
start server "$REPO/server" env PORT="$API_PORT" HOST=0.0.0.0 NODE_ENV=development \
  CORS_ORIGINS="$WEB_URL" DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" \
  ${secrets[@]+"${secrets[@]}"} \
  sh -c 'GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_WEB_API_KEY:-}" exec node_modules/.bin/tsx src/index.ts'

echo "up: writing blog photos"
(cd "$REPO/client" && npm run --silent blog-photos >"$LOGS/blog-photos-$API_PORT.log" 2>&1) ||
  fail "npm run blog-photos failed, see $LOGS/blog-photos-$API_PORT.log"

echo "up: starting the client on $WEB_PORT"
start client "$REPO/client" env NEXT_PUBLIC_MOCK_MODE=off NEXT_PUBLIC_BACKEND_URL="$API_URL" \
  NEXT_PUBLIC_API_URL="$API_URL" BACKEND_URL="$API_URL" NEXT_PUBLIC_APP_URL="$WEB_URL" \
  ${secrets[@]+"${secrets[@]}"} \
  sh -c 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_WEB_API_KEY:-}" exec node_modules/.bin/next dev -p "$0"' "$WEB_PORT"

wait_for() {
  local name="$1" url="$2" pattern="$3" deadline=$((SECONDS + $4))
  until curl -fsS --max-time 60 "$url" 2>/dev/null | grep -q "$pattern"; do
    kill -0 "$(cat "$RUN/$name.pid")" 2>/dev/null || fail "$name exited, see $LOGS/$name-$API_PORT.log"
    [ "$SECONDS" -lt "$deadline" ] || fail "$name not ready at $url after $4s, see $LOGS/$name-$API_PORT.log"
    sleep 2
  done
}
wait_for server "$API_URL/health/ready" '"database":"ok"' 120
wait_for client "$WEB_URL/blog" 'href="/blog/' 300

package_sha "$REPO/server" > "$RUN/server.sha"
package_sha "$REPO/client" > "$RUN/client.sha"
echo "where2meet ready server=$(cat "$RUN/server.sha") at $API_URL client=$(cat "$RUN/client.sha") at $WEB_URL"

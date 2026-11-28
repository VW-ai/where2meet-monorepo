# Shared settings for up.sh, doctor.sh, down.sh and sql.sh. Source it, do not run it.
# shellcheck shell=bash

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd -P)"
API_PORT="${W2M_API_PORT:-3000}"
WEB_PORT="${W2M_WEB_PORT:-3001}"
PG_PORT="${W2M_PG_PORT:-5434}"
REDIS_PORT="${W2M_REDIS_PORT:-6380}"

ROOT=/tmp/verify-where2meet
RUN="$ROOT/run-$API_PORT"
LOGS="$ROOT/logs"
EVIDENCE="$ROOT/evidence"
PROJECT="w2m-verify-$API_PORT"
API_URL="http://localhost:$API_PORT"
WEB_URL="http://localhost:$WEB_PORT"
DATABASE_URL="postgresql://postgres:postgres@localhost:$PG_PORT/where2meet?schema=public"
REDIS_URL="redis://localhost:$REDIS_PORT"

compose() {
  docker compose -p "$PROJECT" -f "$REPO/server/docker-compose.yml" -f "$RUN/ports.yml" "$@"
}

listener_pid() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1
}

pid_cwd() {
  if [ -e "/proc/$1/cwd" ]; then
    readlink "/proc/$1/cwd"
  else
    lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'
  fi
}

container_on_port() {
  docker ps --filter "publish=$1" --format '{{.Label "com.docker.compose.project"}}/{{.Names}}' 2>/dev/null | head -1
}

port_owner() {
  local pid container
  pid="$(listener_pid "$1")"
  container="$(container_on_port "$1")"
  if [ -n "$container" ]; then
    echo "container $container"
  elif [ -n "$pid" ]; then
    echo "pid $pid ($(ps -o comm= -p "$pid" 2>/dev/null)) in $(pid_cwd "$pid")"
  fi
}

package_sha() {
  local sha
  sha="$(git -C "$1" rev-parse --short=12 HEAD)"
  if [ -n "$(git -C "$1" status --porcelain -- .)" ]; then sha="$sha+dirty"; fi
  echo "$sha"
}

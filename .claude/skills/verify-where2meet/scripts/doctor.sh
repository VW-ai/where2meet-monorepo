#!/usr/bin/env bash
# Read-only check that the instance up.sh started is worth driving. Exits non-zero and names each failing service.
# Usage: scripts/doctor.sh, with the same W2M_*_PORT values given to up.sh.
set -uo pipefail
. "$(dirname "$0")/lib.sh"

failed=0
ok() { echo "ok    $*"; }
bad() { echo "FAIL  $*"; failed=1; }

if [ ! -f "$RUN/repo" ]; then
  bad "no instance: $RUN is missing. Start one with scripts/up.sh."
fi

for svc in postgres:"$PG_PORT" redis:"$REDIS_PORT"; do
  name="${svc%%:*}" port="${svc##*:}"
  container="$(container_on_port "$port")"
  health="$(docker inspect -f '{{.State.Health.Status}}' "${container#*/}" 2>/dev/null)"
  if [ "${container%%/*}" != "$PROJECT" ]; then
    bad "$name: port $port is ${container:-not published}, expected compose project $PROJECT"
  elif [ "$health" != healthy ]; then
    bad "$name: container ${container#*/} is ${health:-not running}"
  else
    ok "$name: ${container#*/} healthy on $port"
  fi
done

check_process() {
  local name="$1" port="$2" dir="$3" pid cwd pgid want sha launched
  pid="$(listener_pid "$port")"
  if [ -z "$pid" ]; then
    bad "$name: nothing listens on $port"
    return 1
  fi
  cwd="$(pid_cwd "$pid")"
  pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
  want="$(cat "$RUN/$name.pid" 2>/dev/null)"
  if [ "$cwd" != "$dir" ] || [ "$pgid" != "$want" ]; then
    bad "$name: port $port belongs to pid $pid in $cwd (group $pgid), not this run ($dir, group ${want:-none})"
    return 1
  fi
  sha="$(package_sha "$dir")"
  launched="$(cat "$RUN/$name.sha" 2>/dev/null)"
  if [ -n "$launched" ] && [ "$launched" != "$sha" ]; then
    bad "$name: launched at $launched but the checkout is now $sha. Restart with down.sh and up.sh."
    return 1
  fi
  ok "$name: pid $pid on $port runs $dir at $sha"
}

if check_process server "$API_PORT" "$REPO/server"; then
  ready="$(curl -sS --max-time 10 -w ' %{http_code}' "$API_URL/health/ready" 2>&1)"
  case "$ready" in
    *'"database":"ok"'*'"redis":"ok"'*' 200') ok "server: GET /health/ready 200, database and redis ok" ;;
    *) bad "server: GET /health/ready returned: $ready" ;;
  esac
fi

if check_process client "$WEB_PORT" "$REPO/client"; then
  code="$(curl -sS --max-time 120 -o /dev/null -w '%{http_code}' "$WEB_URL/blog" 2>&1)"
  if [ "$code" = 200 ]; then ok "client: GET /blog 200"; else bad "client: GET /blog returned $code"; fi
fi

if [ -f "$RUN/maps" ]; then
  ok "maps: key injected from Doppler"
else
  echo "warn  maps: no key. Address and venue search fail, so join-and-vote cannot run."
fi

exit "$failed"

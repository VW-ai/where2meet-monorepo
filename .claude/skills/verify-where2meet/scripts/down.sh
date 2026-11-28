#!/usr/bin/env bash
# Stops what up.sh started and deletes its database volume. Keeps logs and evidence under /tmp/verify-where2meet/.
# Safe to run twice. Usage: scripts/down.sh, with the same W2M_*_PORT values given to up.sh.
set -uo pipefail
. "$(dirname "$0")/lib.sh"

for name in client server; do
  pid="$(cat "$RUN/$name.pid" 2>/dev/null)" || continue
  kill -TERM -- "-$pid" 2>/dev/null || continue
  for _ in $(seq 20); do
    kill -0 -- "-$pid" 2>/dev/null || break
    sleep 0.5
  done
  kill -KILL -- "-$pid" 2>/dev/null
  echo "down: stopped $name (group $pid)"
done

if [ ! -f "$RUN/ports.yml" ]; then
  mkdir -p "$RUN"
  printf 'services: {}\n' > "$RUN/ports.yml"
fi
compose down -v --remove-orphans >/dev/null 2>&1 && echo "down: removed compose project $PROJECT"

rm -rf "$RUN"
echo "down: evidence and logs kept in $ROOT"

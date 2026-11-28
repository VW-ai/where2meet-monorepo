#!/usr/bin/env bash
# Runs one read-only SQL query against this run's database and prints the rows.
# Usage: scripts/sql.sh "select id, title from event order by created_at desc limit 5"
set -euo pipefail
. "$(dirname "$0")/lib.sh"
compose exec -T postgres psql -U postgres -d where2meet -v ON_ERROR_STOP=1 \
  -c "begin transaction read only" -c "$1" -c "commit"

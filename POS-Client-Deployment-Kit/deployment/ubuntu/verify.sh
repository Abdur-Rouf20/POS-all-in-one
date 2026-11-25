#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/common.sh"
require_compose
port="$(awk -F= '/^PUBLIC_HTTP_PORT=/{print $2}' .env | tail -n1)"
port="${port:-8080}"
echo '--- Container status ---'
"${COMPOSE[@]}" ps
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${port}/api/health" >/tmp/pos-health.json; then
    echo '--- API health response ---'
    cat /tmp/pos-health.json; echo
    exit 0
  fi
  sleep 5
done
echo 'ERROR: POS health endpoint did not become ready within 150 seconds.' >&2
"${COMPOSE[@]}" logs --tail=100 backend frontend mongo >&2
exit 1

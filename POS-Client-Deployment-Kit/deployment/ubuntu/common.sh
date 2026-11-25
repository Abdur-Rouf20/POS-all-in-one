#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
COMPOSE=(docker compose -f compose.yaml -f deployment/compose.production.yaml)
require_compose() {
  command -v docker >/dev/null 2>&1 || { echo 'ERROR: Docker is not installed.' >&2; exit 1; }
  docker compose version >/dev/null 2>&1 || { echo 'ERROR: Docker Compose plugin is unavailable.' >&2; exit 1; }
  local version
  version="$(docker compose version --short | sed 's/^v//')"
  if [[ "$(printf '%s\n' 2.24.4 "$version" | sort -V | head -n1)" != "2.24.4" ]]; then
    echo "ERROR: Docker Compose 2.24.4+ required for !reset. Found: $version" >&2
    exit 1
  fi
  [[ -f .env ]] || { echo 'ERROR: root .env not found. Copy deployment/.env.production.example to .env and edit it.' >&2; exit 1; }
}

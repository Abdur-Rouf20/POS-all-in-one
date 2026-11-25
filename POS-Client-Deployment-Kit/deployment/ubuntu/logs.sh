#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/common.sh"
require_compose
"${COMPOSE[@]}" logs --tail=200 -f

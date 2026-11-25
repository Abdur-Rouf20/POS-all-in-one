#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/common.sh"
require_compose
# Stops containers but preserves named volumes and customer data.
"${COMPOSE[@]}" stop

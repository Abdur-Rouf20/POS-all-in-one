#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/common.sh"
require_compose
"${COMPOSE[@]}" up -d
"$(dirname "$0")/verify.sh"

#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/common.sh"
require_compose
if grep -Eq 'REPLACE_WITH|YOUR_SERVER_IP|ChangeThisPassword|example\.com' .env; then
  echo 'ERROR: .env still contains one or more example placeholders. Edit it before deployment.' >&2
  exit 1
fi
"${COMPOSE[@]}" config --quiet
echo 'Compose configuration validated. Building and starting POS services...'
"${COMPOSE[@]}" up -d --build --remove-orphans
echo 'Deployment command completed. Running health verification...'
"$(dirname "$0")/verify.sh"

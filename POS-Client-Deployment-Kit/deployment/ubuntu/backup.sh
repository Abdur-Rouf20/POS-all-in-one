#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/common.sh"
require_compose
mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="backups/mongo-${stamp}.archive.gz"
"${COMPOSE[@]}" exec -T mongo sh -lc 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db pos_mvp --archive --gzip' > "$out"
chmod 600 "$out"
echo "Backup created: $out"

#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/common.sh"
require_compose
archive="${1:-}"
[[ -n "$archive" && -f "$archive" ]] || { echo "Usage: $0 backups/mongo-YYYYMMDDTHHMMSSZ.archive.gz" >&2; exit 2; }
echo 'WARNING: This replaces the pos_mvp database contents with the selected backup.'
read -r -p 'Type RESTORE to continue: ' confirm
[[ "$confirm" == RESTORE ]] || { echo 'Restore cancelled.'; exit 1; }
"${COMPOSE[@]}" exec -T mongo sh -lc 'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --drop --archive --gzip --nsInclude='pos_mvp.*'' < "$archive"
echo 'Restore command completed. Verify application data before reopening the POS to users.'

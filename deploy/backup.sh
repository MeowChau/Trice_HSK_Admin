#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
umask 077
mkdir -p backups
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_target="backups/$backup_stamp"
mkdir -- "$backup_target"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_target/database.dump"
docker compose exec -T api tar -czf - -C /app/files . > "$backup_target/uploads.tar.gz"
cp -- .env "$backup_target/config.env"
if [[ "$EUID" -eq 0 ]]; then
  # Keep root-run/cron backups readable by the owner of the deployment config.
  chown --reference=.env backups
  chown -R --reference=.env "$backup_target"
fi
echo "Backup saved to $backup_target. Copy this directory off the VPS."

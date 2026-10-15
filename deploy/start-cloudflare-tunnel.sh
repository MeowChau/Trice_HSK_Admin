#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
for required in .env compose.yaml compose.tunnel.yaml nginx.tunnel.conf; do
  [[ -f "$required" ]] || { printf 'Missing deployment file: %s\n' "$required" >&2; exit 1; }
done
compose() { sudo docker compose -f compose.yaml -f compose.tunnel.yaml "$@"; }
sudo -v
printf 'Paste the Cloudflare Docker command (or just its token), then press Enter. Input is hidden: '
IFS= read -r -s tunnel_input
printf '\n'
tunnel_input=${tunnel_input%$'\r'}
token_pattern='--token[[:space:]=]+([A-Za-z0-9._/+=-]+)'
if [[ "$tunnel_input" =~ $token_pattern ]]; then
  tunnel_token=${BASH_REMATCH[1]}
else
  tunnel_token=$tunnel_input
fi
unset tunnel_input
[[ "$tunnel_token" =~ ^[A-Za-z0-9._/+=-]{40,}$ ]] || { echo 'Cannot read a valid token. Copy the Docker command again.' >&2; exit 1; }
backup_dir="backups/tunnel-$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p -- "$backup_dir"
cp -p -- .env "$backup_dir/config.env"
if [[ -f cloudflare.env ]]; then cp -p -- cloudflare.env "$backup_dir/cloudflare.env"; fi
was_tunnel_running=false
rollback() {
  local exit_status=$?
  trap - ERR
  cp -p -- "$backup_dir/config.env" .env
  if [[ -f "$backup_dir/cloudflare.env" ]]; then cp -p -- "$backup_dir/cloudflare.env" cloudflare.env; fi
  echo 'Tunnel setup failed. Restoring the previous application settings.' >&2
  if [[ "$was_tunnel_running" == true ]]; then
    compose up -d --no-deps --force-recreate --wait api && compose up -d --no-deps --force-recreate web cloudflared || true
  else
    compose stop cloudflared || true
    sudo docker compose -f compose.yaml up -d --no-deps --force-recreate --wait api || true
    sudo docker compose -f compose.yaml up -d --no-deps --force-recreate web || true
  fi
  exit "$exit_status"
}
trap rollback ERR
printf 'TUNNEL_TOKEN=%s\n' "$tunnel_token" > cloudflare.env
chmod 600 cloudflare.env
unset tunnel_token
previous_connector=$(compose ps --status running -q cloudflared)
if [[ -n "$previous_connector" ]]; then was_tunnel_running=true; fi
sed -i '/^FRONTEND_DOMAIN=/d; /^BACKEND_DOMAIN=/d; /^APP_CORS_ORIGINS=/d' .env
printf '\nFRONTEND_DOMAIN=https://admin.tricehsk.id.vn\nBACKEND_DOMAIN=https://api.tricehsk.id.vn\nAPP_CORS_ORIGINS=https://admin.tricehsk.id.vn,https://tricehsk.id.vn,http://localhost:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:18080,http://127.0.0.1:18080\n' >> .env
compose config --quiet
compose pull cloudflared
compose up -d --no-deps --force-recreate --wait api
compose up -d --no-deps --force-recreate web
compose exec -T web nginx -t
curl -fsS --retry 5 --retry-connrefused --retry-delay 2 --max-time 15 -H 'Host: api.tricehsk.id.vn' http://127.0.0.1:8080/health
compose up -d --no-deps --force-recreate cloudflared
printf '\nCLOUDFLARE_CONNECTOR_STARTED: Check the Cloudflare dashboard for Connected/Healthy before adding routes.\n'
compose ps api web cloudflared

#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ $EUID -ne 0 ]]; then echo 'Run this installer with sudo on the VPS.' >&2; exit 1; fi
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
deploy_dir=$(cd -- "$script_dir/.." && pwd)
[[ -f "$deploy_dir/.env" && -f "$deploy_dir/compose.yaml" ]] || { echo 'Extract under the existing deploy directory first.' >&2; exit 1; }
command -v docker > /dev/null
docker compose version
if ! command -v python3 > /dev/null; then
  apt-get update
  apt-get install -y python3
fi
IFS= read -r -p 'GitHub repository [MeowChau/Trice_HSK_Admin]: ' repository
repository=${repository:-MeowChau/Trice_HSK_Admin}
[[ "$repository" =~ ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$ ]] || { echo 'Invalid repository name.' >&2; exit 1; }
IFS= read -r -p 'GitHub username [MeowChau]: ' github_user
github_user=${github_user:-MeowChau}
[[ "$github_user" =~ ^[A-Za-z0-9-]+$ ]] || { echo 'Invalid GitHub username.' >&2; exit 1; }
printf 'Paste a GitHub classic token with read:packages, then Enter (hidden): '
IFS= read -r -s github_token
printf '\n'
[[ -n "$github_token" ]] || { echo 'Token is empty.' >&2; exit 1; }
printf '%s' "$github_token" | docker login ghcr.io --username "$github_user" --password-stdin
unset github_token
install -d -m 755 /usr/local/lib/tricehsk-cd
install -m 755 "$script_dir/deploy.py" /usr/local/lib/tricehsk-cd/deploy.py
install -m 755 "$script_dir/compose.sh" /usr/local/bin/tricehsk-compose
install -m 755 "$script_dir/deploy.sh" /usr/local/bin/tricehsk-deploy
with_tunnel=false
if [[ -f "$deploy_dir/cloudflare.env" && -f "$deploy_dir/compose.tunnel.yaml" ]]; then with_tunnel=true; fi
python3 - "$deploy_dir" "ghcr.io/${repository,,}" "$with_tunnel" <<'PY'
import json, os, sys
from pathlib import Path
config = Path('/etc/tricehsk-cd.json')
temporary = config.with_suffix('.tmp')
temporary.write_text(json.dumps({'directory': sys.argv[1], 'registry': sys.argv[2], 'tunnel': sys.argv[3] == 'true'}, indent=2) + '\n')
temporary.chmod(0o600)
os.replace(temporary, config)
PY
cat > /etc/systemd/system/tricehsk-cd.service <<'UNIT'
[Unit]
Description=Deploy tested TriceHSK application images
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/bin/tricehsk-deploy
TimeoutStartSec=20min
Nice=10
UNIT
cat > /etc/systemd/system/tricehsk-cd.timer <<'UNIT'
[Unit]
Description=Check for a tested TriceHSK release every two minutes

[Timer]
OnBootSec=90s
OnUnitInactiveSec=2min
RandomizedDelaySec=15s
Unit=tricehsk-cd.service

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now tricehsk-cd.timer
printf '\nCI_CD_INSTALLED: The timer will fetch the production release after GitHub CI publishes it.\n'
printf 'Status: sudo tricehsk-deploy --status\nLogs: sudo journalctl -u tricehsk-cd.service -n 50 --no-pager\n'

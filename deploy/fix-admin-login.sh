#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# Run as the deployment owner; only Docker operations use sudo.
login_source=../fe_admin/dashboard/src/components/auth/SignInForm.tsx
if [[ ! -f "$login_source" ]]; then
  echo 'Cannot find SignInForm.tsx. Run this script from the deployed project.' >&2
  exit 1
fi
if [[ ! -e "$login_source.before-login-fix" ]]; then
  cp -p -- "$login_source" "$login_source.before-login-fix"
fi
sed -i 's/<Button className="w-full" size="sm" disabled={isLoading}>/<Button type="submit" className="w-full" size="sm" disabled={isLoading}>/' "$login_source"
if ! grep -F '<Button type="submit" className="w-full" size="sm" disabled={isLoading}>' "$login_source" > /dev/null; then
  echo 'The login component differs from the expected source. Stopping before build.' >&2
  exit 1
fi

compose_files=(-f compose.yaml)
if [[ "${1:-}" == '--tunnel' ]]; then
  compose_files+=(-f compose.tunnel.yaml)
elif [[ -n "${1:-}" ]]; then
  echo 'Usage: bash fix-admin-login.sh [--tunnel]' >&2
  exit 1
fi

echo 'Source verified: the login button submits its form.'
sudo docker compose "${compose_files[@]}" config --quiet
sudo docker compose "${compose_files[@]}" build admin
sudo docker compose "${compose_files[@]}" up -d --no-deps --force-recreate --wait admin
sudo docker compose "${compose_files[@]}" up -d --no-deps --force-recreate web

# Verify the actual response through Nginx, not just the file on disk.
login_html=$(curl -fsS --retry 5 --retry-connrefused --retry-delay 2 --max-time 20 http://127.0.0.1:8080/signin)
submit_pattern='<button[^>]*type="submit"[^>]*>Đăng nhập</button>'
if [[ ! "$login_html" =~ $submit_pattern ]]; then
  echo 'The running page still lacks the submit button. Check the admin/web containers.' >&2
  exit 1
fi
echo 'LOGIN_SUBMIT_OK: the running VPS page now serves the submit button.'
sudo docker compose "${compose_files[@]}" ps admin web

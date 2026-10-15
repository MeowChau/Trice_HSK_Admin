#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ -e .env ]]; then
  echo '.env already exists; keeping its passwords and keys unchanged.'
  exit 0
fi
umask 077
temporary_env=$(mktemp .env.XXXXXX)
trap 'rm -f -- "$temporary_env"' EXIT
while IFS= read -r line || [[ -n "$line" ]]; do
  line=${line%$'\r'}
  if [[ "$line" == *=GENERATE_ME ]]; then
    printf '%s=%s\n' "${line%%=*}" "$(openssl rand -hex 32)"
  else
    printf '%s\n' "$line"
  fi
done < .env.example > "$temporary_env"
mv -- "$temporary_env" .env
trap - EXIT
echo 'Created private .env with random keys. Edit SEED_ADMIN_EMAIL before seeding.'

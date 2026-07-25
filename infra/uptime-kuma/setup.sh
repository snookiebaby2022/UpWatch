#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — set CLOUDFLARE_TUNNEL_TOKEN (recommended) or use --profile caddy for VPS HTTPS."
fi

# shellcheck disable=SC1091
source .env 2>/dev/null || true

if command -v docker >/dev/null 2>&1; then
  :
elif command -v docker.exe >/dev/null 2>&1; then
  alias docker=docker.exe
  alias docker-compose='docker compose'
else
  echo "Docker is required. Install Docker Desktop or Docker Engine first."
  exit 1
fi

if [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  echo "Starting Uptime Kuma + Cloudflare Tunnel (status.upwatch.online)…"
  docker compose --profile cloudflare up -d
else
  echo "No CLOUDFLARE_TUNNEL_TOKEN — starting Kuma on port ${KUMA_HOST_PORT:-3001} only."
  echo "Add a tunnel token to .env or point DNS A record here and run: docker compose --profile caddy up -d"
  docker compose up -d
fi

echo ""
echo "Uptime Kuma admin: http://127.0.0.1:${KUMA_HOST_PORT:-3001}"
echo ""
echo "One-time setup in Kuma UI:"
echo "  1. Create admin account"
echo "  2. Add HTTP demo monitors (e.g. upwatch.online, github.com, google.com)"
echo "  3. Run: bash create-upwatch-status-page.sh  (adds them to the public upwatch status page)"
echo "  4. Verify: https://status.upwatch.online/status/upwatch"
echo "  5. Homepage demo at https://upwatch.online updates within ~30s"
echo ""
echo "Then set in Lovable / GitHub secrets:"
echo "  KUMA_BASE_URL=https://status.upwatch.online"
echo "  KUMA_STATUS_PAGE_SLUG=upwatch"
echo "  VITE_KUMA_PUBLIC_URL=https://status.upwatch.online/status/upwatch"

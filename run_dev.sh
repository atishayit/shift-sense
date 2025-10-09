#!/usr/bin/env bash
set -euo pipefail

# --- INPUTS ---
WEEK_START_ISO="${1:-2025-09-29}"      # Monday ISO
PORT="${PORT:-4000}"
API_KEY="${API_KEY:-devkey-please-change}"
SOLVER_URL_DEFAULT="http://localhost:5001"
API_BASE="http://localhost:${PORT}/api"

# --- CHECKS ---
command -v pnpm >/dev/null || { echo "pnpm not found"; exit 1; }
command -v docker >/dev/null || { echo "docker not found"; exit 1; }
[ -f "package.json" ] || { echo "Run from repo root"; exit 1; }
[ -d "apps/api" ] || { echo "apps/api missing"; exit 1; }
[ -d "apps/web" ] || { echo "apps/web missing"; exit 1; }

# --- HELPERS ---
wait_http() { local u="$1"; for i in {1..60}; do curl -fsS "$u" >/dev/null && return 0; sleep 1; done; echo "Timeout $u"; exit 1; }
curlj() { curl -sS "$@"; }

# --- ENV: API ---
cp infra/.env.local apps/api/.env 2>/dev/null || true
grep -q '^PORT='        apps/api/.env 2>/dev/null || echo "PORT=$PORT" >> apps/api/.env
grep -q '^API_KEY='     apps/api/.env 2>/dev/null || echo "API_KEY=$API_KEY" >> apps/api/.env
grep -q '^SOLVER_URL='  apps/api/.env 2>/dev/null || echo "SOLVER_URL=$SOLVER_URL_DEFAULT" >> apps/api/.env

# --- ENV: WEB ---
# Priority: infra/.env.web.local → apps/web/.env.example → generate minimal .env
if [ ! -f "apps/web/.env" ]; then
  if [ -f "infra/.env.web.local" ]; then
    cp infra/.env.web.local apps/web/.env
  elif [ -f "apps/web/.env.example" ]; then
    cp apps/web/.env.example apps/web/.env
  else
    # Try common keys used by Next.js/Vite
    {
      echo "NEXT_PUBLIC_API_BASE=${API_BASE}"
      echo "VITE_API_BASE=${API_BASE}"
    } > apps/web/.env
  fi
fi

# Ensure API base points to current port
grep -q "NEXT_PUBLIC_API_BASE=" apps/web/.env && sed -i.bak "s|^NEXT_PUBLIC_API_BASE=.*|NEXT_PUBLIC_API_BASE=${API_BASE}|g" apps/web/.env || true
grep -q "VITE_API_BASE="         apps/web/.env && sed -i.bak "s|^VITE_API_BASE=.*|VITE_API_BASE=${API_BASE}|g"         apps/web/.env || true
rm -f apps/web/.env.bak 2>/dev/null || true

# --- INFRA ---
docker compose up -d db redis solver
docker compose ps

# --- DB ---
pnpm db:gen
pnpm db:migrate
pnpm db:seed

# --- START SERVICES (background) ---
mkdir -p logs
pkill -f "apps/api start:dev" 2>/dev/null || true
pkill -f "apps/web dev" 2>/dev/null || true
nohup pnpm -C apps/api start:dev  > logs/api.log  2>&1 &
nohup pnpm -C apps/web dev        > logs/web.log  2>&1 &

# --- WAIT API ---
wait_http "${API_BASE}"

# --- PRESET (forces assignment) ---
curlj -X PUT "${API_BASE/\/api/}/api/orgs/demo/preset" \
  -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
  -d '{"weights":{"assignment":1,"unassigned":1000,"casualPenalty":50,"consecutivePenalty":20},"rules":{"allowCrossLocation":true,"maxHoursPerWeek":60,"minRestHours":0}}' >/dev/null

# --- GENERATE ---
curlj -X POST "${API_BASE/\/api/}/api/orgs/demo/schedules/generate" \
  -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
  -d "{\"weekStartISO\":\"${WEEK_START_ISO}\"}" >/dev/null

SCHED="$(curlj "${API_BASE/\/api/}/api/orgs/demo/schedules" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n1)"
[ -n "$SCHED" ] || { echo "No schedule id found"; exit 1; }

# --- SOLVE + APPLY ---
curlj -X POST "${API_BASE/\/api/}/api/orgs/demo/schedules/${SCHED}/solve" \
  -H "Content-Type: application/json" -H "x-api-key: ${API_KEY}" \
  -d '{"apply":true}' >/dev/null

# --- SUMMARY ---
SUMMARY="$(curlj "${API_BASE/\/api/}/api/schedules/${SCHED}/summary")"
echo "$SUMMARY" | jq . 2>/dev/null || echo "$SUMMARY"

echo
echo "API  : ${API_BASE/\/api/}/api"
echo "WEB  : http://localhost:3000"
echo "SCHED: $SCHED"
echo "Logs : logs/api.log  logs/web.log"
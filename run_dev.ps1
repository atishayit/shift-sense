param(
  [string]$WeekStart = "2025-09-29",
  [int]$Port = 4000,
  [string]$ApiKey = "devkey-please-change",
  [string]$SolverUrl = "http://localhost:5001"
)

$ErrorActionPreference = "Stop"

function Require-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "$name not found" }
}
Require-Cmd pnpm
Require-Cmd docker

if (-not (Test-Path package.json)) { throw "Run from repo root" }
if (-not (Test-Path apps\api)) { throw "apps\api missing" }
if (-not (Test-Path apps\web)) { throw "apps\web missing" }

# --- ENV: API ---
$newApiEnv = @()
$apiEnvPath = "apps\api\.env"
if (Test-Path infra\.env.local -and -not (Test-Path $apiEnvPath)) { Copy-Item infra\.env.local $apiEnvPath }
if (-not (Test-Path $apiEnvPath)) { New-Item -ItemType File -Path $apiEnvPath | Out-Null }
$apiEnv = Get-Content $apiEnvPath -Raw
if ($apiEnv -notmatch '(?m)^PORT=')        { $newApiEnv += "PORT=$Port" }
if ($apiEnv -notmatch '(?m)^API_KEY=')     { $newApiEnv += "API_KEY=$ApiKey" }
if ($apiEnv -notmatch '(?m)^SOLVER_URL=')  { $newApiEnv += "SOLVER_URL=$SolverUrl" }
if ($newApiEnv.Count) { Add-Content $apiEnvPath -Value ($newApiEnv -join "`n") }

# --- ENV: WEB ---
$webEnvPath = "apps\web\.env"
if (-not (Test-Path $webEnvPath)) {
  if (Test-Path infra\.env.web.local) { Copy-Item infra\.env.web.local $webEnvPath }
  elseif (Test-Path apps\web\.env.example) { Copy-Item apps\web\.env.example $webEnvPath }
  else { New-Item -ItemType File -Path $webEnvPath | Out-Null }
}
$apiBase = "http://localhost:$Port/api"
if ((Get-Content $webEnvPath -Raw) -notmatch '(?m)^NEXT_PUBLIC_API_BASE=') { Add-Content $webEnvPath "NEXT_PUBLIC_API_BASE=$apiBase" }
if ((Get-Content $webEnvPath -Raw) -notmatch '(?m)^VITE_API_BASE=')        { Add-Content $webEnvPath "VITE_API_BASE=$apiBase" }

# --- INFRA ---
docker compose up -d db redis solver
docker compose ps | Out-Host

# --- DB: generate/migrate/seed ---
try { pnpm db:gen } catch {
  Push-Location apps\api
  npx prisma generate --schema prisma/schema.prisma
  Pop-Location
}
pnpm db:migrate
pnpm db:seed

# --- START DEV (background) ---
New-Item -ItemType Directory -Path logs -ErrorAction SilentlyContinue | Out-Null
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*pnpm*" -and ($_.MainWindowTitle -like "*apps/api*" -or $_.MainWindowTitle -like "*apps/web*") } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Process pnpm -ArgumentList "-C","apps/api","start:dev" -RedirectStandardOutput logs\api.log -RedirectStandardError logs\api.log -NoNewWindow
Start-Process pnpm -ArgumentList "-C","apps/web","dev"       -RedirectStandardOutput logs\web.log -RedirectStandardError logs\web.log -NoNewWindow

# --- WAIT FOR API ---
$health = "http://localhost:$Port/api"
$max = 60
for ($i=0; $i -lt $max; $i++) {
  try { Invoke-WebRequest -Uri $health -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Seconds 1 }
  if ($i -eq $max-1) { throw "API not responding at $health" }
}

# --- PRESET ---
$presetBody = @{
  weights = @{ assignment = 1; unassigned = 1000; casualPenalty = 50; consecutivePenalty = 20 }
  rules   = @{ allowCrossLocation = $true; maxHoursPerWeek = 60; minRestHours = 0 }
} | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Method PUT -Uri "$apiBase/orgs/demo/preset" -Headers @{ 'x-api-key'=$ApiKey } -ContentType 'application/json' -Body $presetBody | Out-Null

# --- GENERATE SCHEDULE ---
$genBody = @{ weekStartISO = $WeekStart } | ConvertTo-Json -Compress
Invoke-RestMethod -Method POST -Uri "$apiBase/orgs/demo/schedules/generate" -Headers @{ 'x-api-key'=$ApiKey } -ContentType 'application/json' -Body $genBody | Out-Null

# --- GET SCHEDULE ID ---
$schedules = Invoke-RestMethod "$apiBase/orgs/demo/schedules"
if (-not $schedules) { throw "No schedules returned" }
$SCHED = $schedules[0].id
if (-not $SCHED) { throw "Could not extract schedule id" }

# --- SOLVE + APPLY ---
$solveBody = @{ apply = $true } | ConvertTo-Json -Compress
Invoke-RestMethod -Method POST -Uri "$apiBase/orgs/demo/schedules/$SCHED/solve" -Headers @{ 'x-api-key'=$ApiKey } -ContentType 'application/json' -Body $solveBody | Out-Null

# --- SUMMARY ---
$summary = Invoke-RestMethod "$apiBase/schedules/$SCHED/summary"
$summary | ConvertTo-Json -Depth 8

"`nAPI  : $apiBase"
"WEB  : http://localhost:3000"
"SCHED: $SCHED"
"Logs : $(Resolve-Path logs\api.log), $(Resolve-Path logs\web.log)"

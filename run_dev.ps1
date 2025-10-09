param(
  [string]$WeekStart = "2025-09-29",
  [int]$Port = 4000,
  [string]$ApiKey = "devkey-please-change",
  [string]$SolverUrl = "http://localhost:5001"
)

$ErrorActionPreference = "Stop"
function Req($n){ if(-not(Get-Command $n -ErrorAction SilentlyContinue)){ throw "$n not found" } }
Req pnpm; Req docker

if(-not(Test-Path package.json)){ throw "Run from repo root" }
if(-not(Test-Path apps\api)){ throw "apps\api missing" }
if(-not(Test-Path apps\web)){ throw "apps\web missing" }

# 0) Install
if(-not (Test-Path node_modules)){ pnpm install }
if(-not (Test-Path apps\api\node_modules)){ pnpm install }

# 1) ENV: API
$apiEnvPath = "apps\api\.env"
if((Test-Path infra\.env.local) -and -not(Test-Path $apiEnvPath)){ Copy-Item infra\.env.local $apiEnvPath }
if(-not(Test-Path $apiEnvPath)){ New-Item -ItemType File -Path $apiEnvPath | Out-Null }
$add=@(); $raw = (Get-Content $apiEnvPath -Raw)
if($raw -notmatch '(?m)^PORT='){       $add += "PORT=$Port" }
if($raw -notmatch '(?m)^API_KEY='){    $add += "API_KEY=$ApiKey" }
if($raw -notmatch '(?m)^SOLVER_URL='){ $add += "SOLVER_URL=$SolverUrl" }
if($add.Count){ Add-Content $apiEnvPath ($add -join "`n") }

# 2) ENV: WEB
$webEnvPath = "apps\web\.env"
if(-not(Test-Path $webEnvPath)){
  if(Test-Path infra\.env.web.local){ Copy-Item infra\.env.web.local $webEnvPath }
  elseif(Test-Path apps\web\.env.example){ Copy-Item apps\web\.env.example $webEnvPath }
  else{ New-Item -ItemType File -Path $webEnvPath | Out-Null }
}

# 3) Infra
docker compose up -d db redis solver | Out-Null
docker compose ps | Out-Host

# 4) Prisma gen/migrate/seed
Push-Location apps\api
npx prisma generate --schema prisma/schema.prisma
npx prisma migrate dev --schema prisma/schema.prisma -n "auto"
Pop-Location
pnpm db:seed

# 5) Start dev servers (via cmd.exe to avoid Win32 shim issues)
New-Item -ItemType Directory -Path logs -ErrorAction SilentlyContinue | Out-Null
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Process -FilePath "cmd.exe" -ArgumentList "/c","pnpm -C apps/api start:dev" -RedirectStandardOutput logs\api.out.log -RedirectStandardError logs\api.err.log -NoNewWindow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c","pnpm -C apps/web dev"       -RedirectStandardOutput logs\web.out.log -RedirectStandardError logs\web.err.log -NoNewWindow

# 6) Wait for API
for($i=0;$i -lt 60;$i++){ try{ Invoke-WebRequest -Uri $apiBase -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch{ Start-Sleep 1 } if($i -eq 59){ throw "API not responding at $apiBase" } }

# 7) Preset + Generate + Solve
$preset = @{ weights=@{assignment=1;unassigned=1000;casualPenalty=50;consecutivePenalty=20}; rules=@{allowCrossLocation=$true;maxHoursPerWeek=60;minRestHours=0} } | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Method PUT -Uri "$apiBase/orgs/demo/preset" -Headers @{ 'x-api-key'=$ApiKey } -ContentType 'application/json' -Body $preset | Out-Null

$gen = @{ weekStartISO = $WeekStart } | ConvertTo-Json -Compress
Invoke-RestMethod -Method POST -Uri "$apiBase/orgs/demo/schedules/generate" -Headers @{ 'x-api-key'=$ApiKey } -ContentType 'application/json' -Body $gen | Out-Null

$schedules = Invoke-RestMethod "$apiBase/orgs/demo/schedules"
$SCHED = $schedules[0].id

$solve = @{ apply = $true } | ConvertTo-Json -Compress
Invoke-RestMethod -Method POST -Uri "$apiBase/orgs/demo/schedules/$SCHED/solve" -Headers @{ 'x-api-key'=$ApiKey } -ContentType 'application/json' -Body $solve | Out-Null

# 8) Summary
$summary = Invoke-RestMethod "$apiBase/schedules/$SCHED/summary"
$summary | ConvertTo-Json -Depth 8

"`nAPI  : $apiBase"
"WEB  : http://localhost:3000"
"SCHED: $SCHED"
"Logs : $(Resolve-Path logs\api.out.log), $(Resolve-Path logs\web.out.log)"

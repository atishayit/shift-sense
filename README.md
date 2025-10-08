# ShiftSense

Local-first staff rostering & demand forecasting stack.

- **API (NestJS)** on **:4000** — Postgres (Prisma), Redis cache, OpenAPI.
- **Web (Next.js App Router)** on **:3000** — roster, runs, audit, forecast UIs.
- **Solver (FastAPI + OR-Tools)** on **:5001** — CP-SAT optimizer & TS forecast.
- **Infra**: Postgres 16, Redis 7 via Docker Compose.

> Examples use Windows PowerShell (`^` line-continuations). macOS/Linux are equivalent (`\`).

---

## Features

- Orgs, locations, teams, roles, employees  
- Demand templates → **generate** weekly schedules  
- **Solve** (CP-SAT): role eligibility, availability, time-off, weekly cap, 12h rest  
- **Pin/Unpin** assignments; re-solve respects pins  
- **Audit log** (pin/unpin, preset save) with UI  
- **Forecast** endpoint (AR + rolling backtests), confidence band, horizon toggle  
- **Redis caching** for GETs (orgs, employees, schedules, demand) + write-side bust  
- **OpenAPI** at `/api/docs`  
- **API key guard** for mutating routes (`x-api-key`)  

---

## Stack

- **API**: NestJS 11, Prisma 5.22, PostgreSQL, Redis, Axios, Swagger  
- **Web**: Next.js 14 (App Router), TailwindCSS, Recharts  
- **Solver**: FastAPI, OR-Tools, NumPy, Pandas, Statsmodels  
- **DX**: pnpm workspaces, Docker Compose, `concurrently`

---

## Architecture

```mermaid
flowchart LR
  subgraph Web[Web (Next.js)]
    UI1[Roster]
    UI2[Runs]
    UI3[Audit]
    UI4[Forecast]
  end

  subgraph API[NestJS API :4000]
    CTRL[Controllers]
    SRV[Services]
    AUD[AuditService]
    RED[RedisService]
    SWG[/OpenAPI/]
  end

  subgraph DB[(Postgres 16)]
    PRISMA[(Prisma schema)]
  end

  subgraph Cache[(Redis 7)]
    RDS{{Keys: org:*, schedules:*, demand:*}}
  end

  subgraph Solver[FastAPI :5001]
    SOLVE[/POST /solve/]
    FCST[/POST /forecast/]
  end

  Web <--> API
  API -- Prisma --> DB
  API -- RedisService --> Cache
  API -- Axios --> Solver
  CTRL --> SWG
```

---

## ERD (high-level)

```mermaid
erDiagram
  Organization ||--o{ Location : has
  Organization ||--o{ Team : has
  Organization ||--o{ Role : has
  Organization ||--o{ Employee : employs

  Employee ||--o{ Availability : has
  Employee ||--o{ TimeOff : has

  Schedule ||--o{ Shift : has
  Shift ||--o{ Assignment : has
  Schedule ||--o{ ScheduleRun : produces

  Organization ||--o| ConstraintPreset : has

  ForecastRun ||--o{ ForecastFold : has
  Organization ||--o{ ForecastRun : owns
```

---

## One-command dev start (recommended)

This **sets up DB, seeds, and runs all services** (db, redis, solver, api, web).

```powershell
pnpm setup:dev && pnpm dev:all
```

**What it does**

- `setup:dev`
  - `pnpm install`
  - `docker compose up -d db redis`
  - `pnpm -C apps/api exec prisma migrate dev --schema prisma/schema.prisma`
  - `pnpm -C apps/api run db:seed`
  - `docker compose up -d solver` (Python service in Docker)
- `dev:all`
  - runs API (`:4000`), Web (`:3000`), and tails solver logs

> Prefer Docker for the solver on Windows. For a local Python solver, see **Manual setup**.

---

## Manual setup (alternative)

### 1) Prereqs
Node 20+ (v23 OK), pnpm; Python 3.11+; Docker Desktop.

### 2) Install deps
```powershell
pnpm install
```

### 3) Start infra
```powershell
docker compose up -d db redis
```

### 4) DB migrate + seed
```powershell
pnpm -C apps/api exec prisma migrate dev --schema prisma/schema.prisma
pnpm -C apps/api run db:seed
```

### 5a) Solver in Docker
```powershell
docker compose up -d solver
```

### 5b) Solver locally
```powershell
cd services/solver
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5001
```

### 6) Run API & Web
```powershell
pnpm -C apps/api start:dev
pnpm -C apps/web dev
```

Open:  
Web → http://localhost:3000  
API → http://localhost:4000  
Solver → http://127.0.0.1:5001  
Swagger → http://localhost:4000/api/docs

---

## Environment

**apps/api/.env**
```
DATABASE_URL=postgresql://shiftsense:shiftsense@localhost:5432/shiftsense?schema=public
SOLVER_URL=http://127.0.0.1:5001
REDIS_URL=redis://127.0.0.1:6379
API_KEY=devkey-please-change
PORT=4000
```

**apps/web/.env**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

> With full docker-compose, API uses `solver:5001` & `redis:6379` internally.

---

## Smoke tests (curl)

```powershell
# Orgs
curl http://localhost:4000/api/orgs
curl http://localhost:4000/api/orgs/demo

# Employees (GET is public)
curl http://localhost:4000/api/orgs/demo/employees

# Demand (GET is public)
curl http://localhost:4000/api/orgs/demo/demand
```

**Write routes require API key** (`x-api-key: $env:API_KEY`):

```powershell
# Create demand row
curl -i -X POST http://localhost:4000/api/orgs/demo/demand ^
  -H "content-type: application/json" ^
  -H "x-api-key: devkey-please-change" ^
  -d "{\"locationId\":\"<locId>\",\"roleId\":\"<roleId>\",\"weekday\":1,\"startTime\":\"09:00\",\"endTime\":\"17:00\",\"required\":2}"

# Save constraint preset
curl -i -X POST http://localhost:4000/api/orgs/demo/preset ^
  -H "content-type: application/json" -H "x-api-key: devkey-please-change" ^
  -d "{\"weights\":{\"cost\":1,\"casualPenalty\":50,\"consecutivePenalty\":20}}"

# Generate schedule
curl -i -X POST http://localhost:4000/api/orgs/demo/schedules/generate ^
  -H "content-type: application/json" -H "x-api-key: devkey-please-change" ^
  -d "{\"weekStartISO\":\"2025-09-29\"}"

# Solve
curl -i -X POST http://localhost:4000/api/orgs/demo/schedules/<scheduleId>/solve ^
  -H "content-type: application/json" -H "x-api-key: devkey-please-change" -d "{}"

# Pin/Unpin
curl -i -X PATCH http://localhost:4000/api/assignments/<assignmentId>/pin   -H "x-api-key: devkey-please-change"
curl -i -X PATCH http://localhost:4000/api/assignments/<assignmentId>/unpin -H "x-api-key: devkey-please-change"
```

---

## Redis caching

**Keys**
- Orgs: `org:list`, `org:<id>`
- Employees: `org:<orgId>:employees:list`
- Schedules: `schedules:list:<orgId>`, `schedule:<id>`, `schedule:<id>:summary`
- Demand: `demand:<orgId>:all`, `demand:<orgId>:<locationId>`
- Forecast (UI cache): `forecast:<orgId>:<horizon>`

**Bust on writes** is implemented per service.

Inspect:
```powershell
docker exec -it redis redis-cli KEYS "*"
docker exec -it redis redis-cli GET "schedule:<id>"
```

---

## Forecast & persistence

**Endpoint**: `GET /api/orgs/:orgRef/forecast?horizon=14` → builds 8-week daily series from templates, calls Solver `/forecast`, returns history + forecast + backtest MAPE.

**Persistence**
- `ForecastRun { id, orgId, createdAt, method, horizonDays, mapeAvg }`
- `ForecastFold { runId, foldIndex, mape, mae, rmse }`

List runs:
```powershell
curl http://localhost:4000/api/orgs/demo/forecast/runs
```

**Web**
- `/forecast` — chart
- `/forecast/runs` — table with avg MAPE & per-fold MAPE

---

## Demo walkthrough

1. **Roster** → `/roster`, re-solve, note cost & pinned badges  
2. **Runs** → `/runs`, pick run, re-solve  
3. **Audit** → pin/unpin in roster, check `/audit`  
4. **Forecast** → `/forecast`, try horizon 7/14/28/56  
5. **Forecast runs** → `/forecast/runs`, inspect MAPEs  

---

## Swagger

http://localhost:4000/api/docs

---

## Useful dev commands

```powershell
pnpm -C apps/api exec prisma migrate status --schema prisma/schema.prisma
pnpm -C apps/api exec prisma studio --schema prisma/schema.prisma
pnpm -C apps/api lint
pnpm -C apps/web lint
```

---

## License

MIT — demo/portfolio.

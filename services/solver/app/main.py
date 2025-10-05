from fastapi import FastAPI
from pydantic import BaseModel
from ortools.sat.python import cp_model
from datetime import datetime

class Shift(BaseModel):
    id: str
    start: str
    end: str
    required: int
    roleId: str

class Av(BaseModel):
    weekday: int
    start: str
    end: str

class TO(BaseModel):
    start: str
    end: str

class Employee(BaseModel):
    id: str
    hourlyCost: float
    roleIds: list[str]
    maxWeeklyHours: int = 38
    employmentType: str
    avail: list[Av] = []
    timeOffs: list[TO] = []

class SolveRequest(BaseModel):
    shifts: list[Shift]
    employees: list[Employee]
    config: dict | None = None

def iso(dt: str) -> datetime:
    return datetime.fromisoformat(dt.replace("Z", "+00:00"))

def minutes(dt: datetime) -> int:
    return int(dt.timestamp() // 60)

def hhmm_to_min(x: str) -> int:
    h, m = x.split(":")
    return int(h) * 60 + int(m)

app = FastAPI()

@app.post("/solve")
def solve(req: SolveRequest):
    cfg = req.config or {}
    W = (cfg.get("weights") or {})
    casual_pen = int(W.get("casualPenalty", 0))       # points per casual assignment
    consec_pen = int(W.get("consecutivePenalty", 0))  # points per employee for each consecutive-day pair
    # cost weight handled by wages directly

    # preprocess shifts
    S = []
    for s in req.shifts:
        st, en = iso(s.start), iso(s.end)
        S.append({
            "id": s.id, "role": s.roleId, "st": st, "en": en,
            "dur_min": int((en - st).total_seconds() // 60),
            "wday": st.weekday(),  # Mon=0
            "st_md": st.hour * 60 + st.minute,
            "en_md": en.hour * 60 + en.minute,
        })

    m = cp_model.CpModel()

    # decision vars
    X = {}  # X[(sid, eid)]
    for s in S:
        for e in req.employees:
            eligible = s["role"] in e.roleIds
            # availability
            within = True
            if e.avail:
                within = False
                for a in e.avail:
                    # convert Sun..Sat(0..6) to Python Mon..Sun
                    py = (a.weekday + 6) % 7
                    if py != s["wday"]:
                        continue
                    if hhmm_to_min(a.start) <= s["st_md"] and s["en_md"] <= hhmm_to_min(a.end):
                        within = True
                        break
            # timeoff
            free = True
            for t in e.timeOffs:
                if not (iso(t.end) <= s["st"] or s["en"] <= iso(t.start)):
                    free = False
                    break
            can = eligible and within and free
            b = m.NewBoolVar(f"x_{s['id']}_{e.id}")
            if not can:
                m.Add(b == 0)
            X[(s["id"], e.id)] = b

    # coverage
    for s in S:
        m.Add(sum(X[(s["id"], e.id)] for e in req.employees) == next(ss.required for ss in req.shifts if ss.id == s["id"]))

    # no overlapping shifts per employee
    for e in req.employees:
        for i in range(len(S)):
            for j in range(i + 1, len(S)):
                si, sj = S[i], S[j]
                if not (si["en"] <= sj["st"] or sj["en"] <= si["st"]):
                    m.Add(X[(si["id"], e.id)] + X[(sj["id"], e.id)] <= 1)

    # 12h rest rule
    REST = 12 * 60
    for e in req.employees:
        for i in range(len(S)):
            for j in range(len(S)):
                if i == j:
                    continue
                gap = (S[j]["st"] - S[i]["en"]).total_seconds() // 60
                if gap < REST:
                    m.Add(X[(S[i]["id"], e.id)] + X[(S[j]["id"], e.id)] <= 1)

    # weekly hours cap
    for e in req.employees:
        m.Add(sum(S[i]["dur_min"] * X[(S[i]["id"], e.id)] for i in range(len(S))) <= e.maxWeeklyHours * 60)

    # soft penalties
    pen_terms: list[cp_model.IntVar | cp_model.LinearExpr] = []

    # consecutive days penalty per employee
    for e in req.employees:
        day_has = [m.NewBoolVar(f"d_{e.id}_{d}") for d in range(7)]
        for d in range(7):
            # day d is true if any shift that day is taken
            sd = [X[(s["id"], e.id)] for s in S if s["wday"] == d]
            if sd:
                for v in sd:
                    m.AddImplication(v, day_has[d])
                m.Add(day_has[d] <= sum(sd))
            else:
                m.Add(day_has[d] == 0)
        for d in range(6):
            y = m.NewBoolVar(f"consec_{e.id}_{d}")
            # y = AND(day_has[d], day_has[d+1])
            m.Add(y <= day_has[d]); m.Add(y <= day_has[d + 1])
            m.Add(y >= day_has[d] + day_has[d + 1] - 1)
            if consec_pen:
                pen_terms.append(consec_pen * y)

    # objective: wage cost + soft penalties
    wage_terms = []
    for s in S:
        for e in req.employees:
            cents = int(round(e.hourlyCost * 100))
            base = cents * X[(s["id"], e.id)]
            if e.employmentType == "CASUAL" and casual_pen:
                base += casual_pen * X[(s["id"], e.id)]
            wage_terms.append(base)

    m.Minimize(sum(wage_terms) + sum(pen_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    status = solver.Solve(m)

    out = {"status": int(status), "objective": solver.ObjectiveValue(), "assignments": []}
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for s in S:
            for e in req.employees:
                if solver.Value(X[(s["id"], e.id)]) == 1:
                    out["assignments"].append({"shiftId": s["id"], "employeeId": e.id})
    return out

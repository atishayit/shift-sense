from fastapi import FastAPI
from pydantic import BaseModel
from ortools.sat.python import cp_model
from typing import List, Optional
from datetime import datetime, timedelta
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX
import warnings

warnings.filterwarnings("ignore")

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
    roleIds: List[str]
    maxWeeklyHours: int = 38
    employmentType: str
    avail: List[Av] = []
    timeOffs: List[TO] = []

class Pin(BaseModel):
    shiftId: str
    employeeId: str

class SolveRequest(BaseModel):
    shifts: List[Shift]
    employees: List[Employee]
    # support either top-level weights or legacy config.weights
    weights: Optional[dict] = {}
    config: Optional[dict] = None
    pinned: Optional[List[Pin]] = []

class TSPoint(BaseModel):
    ds: str   # ISO date "YYYY-MM-DD" or full ISO
    y: float  # value


class ForecastReq(BaseModel):
    series: List[TSPoint]             # historical daily points (ordered)
    horizon_days: int = 14            # forecast horizon
    seasonal_period: int = 7          # weekly seasonality
    backtest_folds: int = 3           # rolling-origin folds

def iso(dt: str) -> datetime:
    return datetime.fromisoformat(dt.replace("Z", "+00:00"))

def hhmm_to_min(x: str) -> int:
    h, m = x.split(":")
    return int(h) * 60 + int(m)

def _mape(y_true, y_pred) -> float:
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)
    denom = np.maximum(np.abs(y_true), 1e-6)
    return float(np.mean(np.abs((y_true - y_pred) / denom)) * 100.0)

app = FastAPI()

@app.post("/solve")
def solve(req: SolveRequest):
    # weights
    W = req.weights or {}
    if not W and req.config and isinstance(req.config, dict):
        W = (req.config.get("weights") or {})
    casual_pen = int(W.get("casualPenalty", 0))
    consec_pen = int(W.get("consecutivePenalty", 0))

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
            "required": s.required,
        })

    m = cp_model.CpModel()

    # decision vars
    X = {}
    for s in S:
        for e in req.employees:
            eligible = s["role"] in e.roleIds
            # availability check
            within = True
            if e.avail:
                within = False
                for a in e.avail:
                    py = (a.weekday + 6) % 7  # convert Sun..Sat to Mon..Sun
                    if py != s["wday"]:
                        continue
                    if hhmm_to_min(a.start) <= s["st_md"] and s["en_md"] <= hhmm_to_min(a.end):
                        within = True
                        break
            # time off check
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

    # enforce pinned
    pinned_set = {(p.shiftId, p.employeeId) for p in (req.pinned or [])}
    for s in S:
        for e in req.employees:
            if (s["id"], e.id) in pinned_set:
                m.Add(X[(s["id"], e.id)] == 1)

    # coverage
    for s in S:
        m.Add(sum(X[(s["id"], e.id)] for e in req.employees) == s["required"])

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

    # penalties
    pen_terms = []

    # consecutive days penalty
    for e in req.employees:
        day_has = [m.NewBoolVar(f"d_{e.id}_{d}") for d in range(7)]
        for d in range(7):
            sd = [X[(s["id"], e.id)] for s in S if s["wday"] == d]
            if sd:
                for v in sd:
                    m.AddImplication(v, day_has[d])
                m.Add(day_has[d] <= sum(sd))
            else:
                m.Add(day_has[d] == 0)
        for d in range(6):
            y = m.NewBoolVar(f"consec_{e.id}_{d}")
            m.Add(y <= day_has[d]); m.Add(y <= day_has[d + 1])
            m.Add(y >= day_has[d] + day_has[d + 1] - 1)
            if consec_pen:
                pen_terms.append(consec_pen * y)

    # wage cost + casual penalty
    wage_terms = []
    for s in S:
        for e in req.employees:
            cents = int(round(e.hourlyCost * 100))
            term = cents * X[(s["id"], e.id)]
            if e.employmentType == "CASUAL" and casual_pen:
                term += casual_pen * X[(s["id"], e.id)]
            wage_terms.append(term)

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

@app.post("/forecast")
def forecast(req: ForecastReq):
    # parse history
    xs = []
    ys = []
    for p in req.series:
        # accept "YYYY-MM-DD" or full ISO
        ds = p.ds if len(p.ds) > 10 else (p.ds + "T00:00:00")
        xs.append(datetime.fromisoformat(ds.replace("Z", "+00:00")))
        ys.append(float(p.y))
    values = np.array(ys, dtype=float)

    # guardrails
    sp = max(2, int(req.seasonal_period or 7))
    order = (1, 0, 1)
    seasonal_order = (1, 0, 1, sp)

    # rolling-origin backtest
    folds = []
    min_len = max(14, sp * 2)
    if len(values) >= min_len and req.backtest_folds > 0:
        fold_len = max(7, len(values) // (req.backtest_folds + 1))
        for f in range(req.backtest_folds):
            train_end = min_len + f * fold_len
            test_len = min(7, max(1, len(values) - train_end))
            if train_end + test_len > len(values):
                break
            train = values[:train_end]
            test = values[train_end:train_end + test_len]
            try:
                model = SARIMAX(train, order=order, seasonal_order=seasonal_order,
                                enforce_stationarity=False, enforce_invertibility=False)
                fit = model.fit(disp=False)
                fc = fit.get_forecast(steps=test_len)
                pred = fc.predicted_mean
                folds.append(_mape(test, pred))
            except Exception:
                # skip failed fold
                continue

    # final fit on full history
    model = SARIMAX(values, order=order, seasonal_order=seasonal_order,
                    enforce_stationarity=False, enforce_invertibility=False)
    fit = model.fit(disp=False)
    h = int(req.horizon_days or 14)
    fc = fit.get_forecast(steps=h)
    mean = fc.predicted_mean
    conf = fc.conf_int(alpha=0.2)

    # handle ndarray or DataFrame
    conf_arr = np.asarray(conf)
    lower = conf_arr[:, 0]
    upper = conf_arr[:, 1]

    last = xs[-1]
    horizon = [last + timedelta(days=i + 1) for i in range(h)]

    def ppack(dt, val):
        return {"ds": dt.isoformat(), "y": float(val)}

    return {
        "yhat":       [ppack(d, mean[i])  for i, d in enumerate(horizon)],
        "yhat_lower": [ppack(d, lower[i]) for i, d in enumerate(horizon)],
        "yhat_upper": [ppack(d, upper[i]) for i, d in enumerate(horizon)],
        "mape": (float(np.mean(folds)) if folds else None),
        "folds": (folds if folds else None),
    }

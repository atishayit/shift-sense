'use client';

import { useEffect, useState } from 'react';

const API = 'http://localhost:4000/api';
const ORG = 'demo';

function fmt(dt: string) {
  return new Date(dt).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
}

type Assignment = { id: string; isPinned: boolean; cost: string; employee: { id: string; code: string; firstName: string; lastName: string } };
type Shift = { id: string; start: string; end: string; required: number; role: { name: string }; location: { name: string }; assignments: Assignment[] };
type Sched = { id: string; weekStart: string; totalCost?: number; shifts: Shift[] };

export default function Roster() {
  const [sched, setSched] = useState<Sched | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const list = await fetch(`${API}/orgs/${ORG}/schedules`, { cache: 'no-store' }).then(r => r.json()).catch(() => []);
    if (!Array.isArray(list) || list.length === 0) { setSched(null); return; }
    const full = await fetch(`${API}/schedules/${list[0].id}`, { cache: 'no-store' }).then(r => r.json());
    setSched(full);
  }

  useEffect(() => { load(); }, []);

  async function togglePin(s: Shift, a: Assignment) {
    setBusy(true);
    const route = a.isPinned ? 'unpin' : 'pin';
    // call the new pair-based route
    await fetch(`${API}/assignments/${route}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId: s.id, employeeId: a.employee.id }),
    }).catch(() => { });
    await load();
    setBusy(false);
  }

  if (!sched) return <main className="p-6">No schedule.</main>;

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roster • {new Date(sched.weekStart).toDateString()}</h1>
        <div className="text-lg">Total cost: ${Number(sched.totalCost ?? 0).toFixed(2)}</div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sched.shifts.map((s) => (
          <div key={s.id} className="border rounded p-3 space-y-1">
            <div className="font-medium">{s.role.name} @ {s.location.name}</div>
            <div className="text-sm text-gray-600">{fmt(s.start)} → {fmt(s.end)}</div>
            <div className="text-sm">Required: {s.required}</div>
            <ul className="text-sm list-disc pl-5 space-y-1">
              {s.assignments?.length
                ? s.assignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span>
                      {a.employee.code} — {a.employee.firstName} {a.employee.lastName}
                      {' '}(${Number(a.cost).toFixed(2)})
                    </span>
                    <button
                      disabled={busy}
                      className="text-xs underline opacity-80 hover:opacity-100"
                      onClick={() => togglePin(s, a)}   // pass shift s along
                      title={a.isPinned ? 'Unpin' : 'Pin'}
                    >
                      {a.isPinned ? 'Unpin' : 'Pin'}
                    </button>
                  </li>
                ))
                : <li className="text-red-600">Unassigned</li>}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}

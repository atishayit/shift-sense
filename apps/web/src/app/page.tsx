'use client';

import { useEffect, useState } from 'react';

const API = 'http://localhost:4000/api';

type SchedLite = { id: string; weekStart: string };
type SchedFull = {
  id: string; weekStart: string; totalCost?: number;
  shifts: {
    id: string; required: number; start: string; end: string;
    location: { name: string }; role: { name: string };
    assignments: {
      id: string; cost: string;
      employee: { code: string; firstName: string; lastName: string }
    }[];
  }[];
};

export default function Roster() {
  const [sched, setSched] = useState<SchedFull | null>(null);
  const [orgSlug] = useState('demo');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const list: SchedLite[] = await fetch(`${API}/orgs/${orgSlug}/schedules`, { cache: 'no-store' }).then(r => r.json());
      if (!list.length) return;

      const details: SchedFull[] = await Promise.all(
        list.slice(0, 5).map(s => fetch(`${API}/schedules/${s.id}`, { cache: 'no-store' }).then(r => r.json()))
      );
      const withAsg = details.find(s => s.shifts.some(x => x.assignments?.length > 0));
      setSched(withAsg ?? details[0]);
    })();
  }, [orgSlug]);

  async function solveNow() {
    if (!sched) return;
    setBusy(true);
    await fetch(`${API}/orgs/${orgSlug}/schedules/${sched.id}/solve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const refreshed: SchedFull = await fetch(`${API}/schedules/${sched.id}`, { cache: 'no-store' }).then(r => r.json());
    setSched(refreshed);
    setBusy(false);
  }

  const fmt = (dt: string) => new Date(dt).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });

  if (!sched) return <main className="p-6">No schedule.</main>;

  const cost = Number(sched.totalCost ?? 0);

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Roster • {new Date(sched.weekStart).toDateString()} • {sched.id}
        </h1>
        <div className="flex items-center gap-3">
          <div className="text-lg">Total cost: ${cost.toFixed(2)}</div>
          <button onClick={solveNow} disabled={busy} className="border px-3 py-2 rounded">
            {busy ? 'Solving…' : 'Re-solve'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sched.shifts.map(s => (
          <div key={s.id} className="border rounded p-3">
            <div className="font-medium">{s.role.name} @ {s.location.name}</div>
            <div className="text-sm text-gray-500">{fmt(s.start)} → {fmt(s.end)}</div>
            <div className="text-sm mt-1">Required: {s.required}</div>
            <ul className="text-sm list-disc pl-5 mt-1">
              {s.assignments?.length
                ? s.assignments.map(a => (
                  <li key={a.id}>
                    {a.employee.code} — {a.employee.firstName} {a.employee.lastName}
                    {Number(a.cost) ? ` ($${Number(a.cost).toFixed(2)})` : ''}
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

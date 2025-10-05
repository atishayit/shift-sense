'use client';

import { useEffect, useState } from 'react';
const API = 'http://localhost:4000/api';

type Run = { id: string; status: string; objective?: string; startedAt?: string; finishedAt?: string };
type Summary = { id: string; weekStart: string; totalCost: number; coverage: number; runs: Run[] };
type SchedLite = { id: string; weekStart: string };

async function getJSON<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return fallback;
    const d = await r.json();
    return (d as any) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function Runs() {
  const [org] = useState('demo');
  const [list, setList] = useState<SchedLite[]>([]);
  const [sel, setSel] = useState<string>('');
  const [sum, setSum] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await getJSON<any>(`${API}/orgs/${org}/schedules`, []);
      const arr: SchedLite[] = Array.isArray(raw) ? raw : [];
      setList(arr);
      if (arr[0]) {
        setSel(arr[0].id);
        await load(arr[0].id);
      }
    })();
  }, [org]);

  async function load(id: string) {
    const s = await getJSON<Summary | null>(`${API}/schedules/${id}/summary`, null);
    setSum(s);
  }

  async function solve() {
    if (!sel) return;
    setBusy(true);
    await fetch(`${API}/orgs/${org}/schedules/${sel}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});
    await load(sel);
    setBusy(false);
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Compare runs</h1>

      <div className="flex items-center gap-3">
        <select
          value={sel}
          onChange={(e) => { const v = e.target.value; setSel(v); load(v); }}
          className="border rounded px-2 py-1"
        >
          {list.length === 0 && <option value="">No schedules</option>}
          {list.map((s) => (
            <option key={s.id} value={s.id}>
              {new Date(s.weekStart).toDateString()} • {s.id}
            </option>
          ))}
        </select>
        <button onClick={solve} disabled={busy || !sel} className="border rounded px-3 py-2">
          {busy ? 'Solving…' : 'Solve again'}
        </button>
        <a href="/roster" className="border rounded px-3 py-2">Open roster</a>
      </div>

      {sum && (
        <>
          <div className="text-sm">
            Coverage: {sum.coverage}% • Total cost: ${sum.totalCost.toFixed(2)}
          </div>
          <table className="w-full text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left">
                <th className="px-2">Run</th>
                <th className="px-2">Status</th>
                <th className="px-2">Objective</th>
                <th className="px-2">Started</th>
                <th className="px-2">Finished</th>
              </tr>
            </thead>
            <tbody>
              {sum.runs.map((r) => (
                <tr key={r.id} className="bg-black/10">
                  <td className="px-2">{r.id}</td>
                  <td className="px-2">{r.status}</td>
                  <td className="px-2">{r.objective ?? ''}</td>
                  <td className="px-2">{r.startedAt ? new Date(r.startedAt).toLocaleString() : ''}</td>
                  <td className="px-2">{r.finishedAt ? new Date(r.finishedAt).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

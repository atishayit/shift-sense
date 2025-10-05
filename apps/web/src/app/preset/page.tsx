'use client';
import { useEffect, useState } from 'react';
const API = 'http://localhost:4000/api';

export default function Preset() {
  const [json, setJson] = useState<string>(''); const [msg, setMsg] = useState<string>('');
  useEffect(() => { (async () => {
    const p = await fetch(`${API}/orgs/demo/preset`, { cache: 'no-store' }).then(r=>r.json());
    setJson(JSON.stringify(p.config ?? p, null, 2));
  })(); }, []);
  async function save() {
    try {
      const cfg = JSON.parse(json);
      await fetch(`${API}/orgs/demo/preset`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(cfg) });
      setMsg('Saved'); setTimeout(()=>setMsg(''), 1200);
    } catch { setMsg('Invalid JSON'); }
  }
  return (
    <main className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Constraint preset</h1>
      <textarea value={json} onChange={e=>setJson(e.target.value)} rows={20} className="w-full border p-2 font-mono text-sm" />
      <div className="flex gap-3">
        <button onClick={save} className="border px-3 py-2 rounded">Save</button>
        <span className="text-sm">{msg}</span>
        <a href="/runs" className="underline text-sm">Go to runs</a>
      </div>
      <p className="text-xs text-gray-500">Keys: weights.cost, weights.casualPenalty, weights.consecutivePenalty</p>
    </main>
  );
}

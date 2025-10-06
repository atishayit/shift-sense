'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';
const ORG = 'demo';

type Fold = { id: string; foldIndex: number; mape: number; mae?: number | null; rmse?: number | null };
type Run = {
  id: string;
  createdAt: string;
  method: string;
  horizonDays: number;
  mapeAvg: number;
  folds: Fold[];
};

export default function ForecastRuns() {
  const [rows, setRows] = useState<Run[]>([]);
  useEffect(() => {
    fetch(`${API}/api/orgs/${ORG}/forecast/runs`).then(r => r.json()).then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Forecast runs</h1>
      <div className="overflow-auto">
        <table className="min-w-[900px] w-full border">
          <thead className="bg-gray-50 text-black">
            <tr>
              <th className="p-2 border">Created</th>
              <th className="p-2 border">Method</th>
              <th className="p-2 border">Horizon</th>
              <th className="p-2 border">MAPE Avg</th>
              <th className="p-2 border">Folds (MAPE)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2 border">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-2 border">{r.method}</td>
                <td className="p-2 border">{r.horizonDays}</td>
                <td className="p-2 border">{r.mapeAvg.toFixed(2)}%</td>
                <td className="p-2 border">
                  {r.folds?.length
                    ? r.folds.map(f => `F${f.foldIndex}:${f.mape.toFixed(2)}%`).join(' · ')
                    : '—'}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td className="p-2 text-gray-500" colSpan={5}>No runs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}

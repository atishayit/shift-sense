'use client';

import { useEffect, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart, Legend, ResponsiveContainer,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';
const ORG = 'demo';

type TSPoint = { ds: string; y: number };
type ForecastResp = {
    history: TSPoint[];
    forecast: {
        yhat: TSPoint[];
        yhat_lower: TSPoint[];
        yhat_upper: TSPoint[];
        mape?: number | null;
        folds?: number[] | null;
    };
};

export default function ForecastPage() {
    const [data, setData] = useState<ForecastResp | null>(null);
    const [h, setH] = useState(14);
    const [loading, setLoading] = useState(false);

    async function load() {
        setLoading(true);
        const res = await fetch(`${API}/api/orgs/${ORG}/forecast?horizon=${h}`, { cache: 'no-store' });
        setData(await res.json());
        setLoading(false);
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

    const merged = (() => {
        if (!data) return [];
        const hist = data.history.map(p => ({ date: p.ds, history: p.y }));
        const f = data.forecast;
        const map: Record<string, any> = {};
        hist.forEach(p => { map[p.date] = { date: p.date, history: p.history }; });
        f.yhat.forEach(p => { map[p.ds] = { ...(map[p.ds] || { date: p.ds }), yhat: p.y }; });
        f.yhat_lower.forEach(p => { map[p.ds] = { ...(map[p.ds] || { date: p.ds }), yhat_lower: p.y }; });
        f.yhat_upper.forEach(p => { map[p.ds] = { ...(map[p.ds] || { date: p.ds }), yhat_upper: p.y }; });
        return Object.values(map);
    })();

    return (
        <div className="space-y-4">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Forecast</h1>
                <div className="flex items-center gap-2">
                    <input
                        type="number" min={7} max={56} value={h}
                        onChange={e => setH(Number(e.target.value))}
                        className="w-24 rounded border border-neutral-700 bg-black px-2 py-1"
                    />
                    <button
                        className="rounded border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-50"
                        onClick={load} disabled={loading}
                    >
                        {loading ? 'Loading…' : 'Run'}
                    </button>
                </div>
            </header>

            {!data && <div>Loading…</div>}
            {data && (
                <>
                    <div className="text-sm opacity-80">
                        {typeof data.forecast.mape === 'number' ? `Backtest MAPE: ${data.forecast.mape.toFixed(2)}%` : 'Backtest MAPE: n/a'}
                    </div>

                    <div className="w-full h-[420px]">
                        <ResponsiveContainer>
                            <AreaChart data={merged}>
                                <defs>
                                    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopOpacity={0.35} />
                                        <stop offset="95%" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Area type="monotone" dataKey="yhat_upper" strokeOpacity={0} fill="url(#band)" name="Upper" />
                                <Area type="monotone" dataKey="yhat_lower" strokeOpacity={0} fill="url(#band)" name="Lower" />
                                <Line type="monotone" dataKey="history" strokeWidth={2} name="History" dot={false} />
                                <Line type="monotone" dataKey="yhat" strokeWidth={2} name="Forecast" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </>
            )}
        </div>
    );
}

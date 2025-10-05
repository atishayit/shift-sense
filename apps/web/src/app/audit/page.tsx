'use client';

import { useEffect, useMemo, useState } from 'react';

type Log = {
    id: string;
    orgId: string | null;
    userId: string | null;
    entity: string;
    entityId: string;
    action: string;
    meta: any;
    createdAt: string;
};

const API = 'http://localhost:4000';

const ORG = 'demo';
const TAKE = 50;

export default function AuditPage() {
    const [logs, setLogs] = useState<Log[] | null>(null);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function load(c?: string | null) {
        setLoading(true);
        const q = new URLSearchParams({ take: String(TAKE) });
        if (c) q.set('cursor', c);
        const res = await fetch(`${API}/api/orgs/${ORG}/audit?` + q.toString(), {
            cache: 'no-store',
        });
        const data = (await res.json()) as Log[];
        setLogs((prev) => (c ? [...(prev ?? []), ...data] : data));
        setLoading(false);
    }

    useEffect(() => {
        load(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const nextCursor = useMemo(() => {
        if (!logs || logs.length < TAKE) return null;
        return logs[logs.length - 1].id;
    }, [logs]);

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Audit log</h1>
                <button
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-50"
                    onClick={() => load(null)}
                    disabled={loading}
                >
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {!logs && <div>Loading…</div>}
            {logs && logs.length === 0 && <div>No events yet.</div>}

            {logs && logs.length > 0 && (
                <div className="space-y-2">
                    {logs.map((l) => (
                        <div
                            key={l.id}
                            className="rounded-lg border border-neutral-700 p-3 text-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div className="font-mono">
                                    <span className="mr-2 rounded px-1.5 py-0.5 text-xs"
                                        style={{
                                            background:
                                                l.action === 'PIN'
                                                    ? 'rgba(34,197,94,.15)'
                                                    : l.action === 'UNPIN'
                                                        ? 'rgba(239,68,68,.15)'
                                                        : l.action.startsWith('SOLVE')
                                                            ? 'rgba(59,130,246,.15)'
                                                            : 'rgba(163,163,163,.15)',
                                            border: '1px solid rgba(120,120,120,.3)',
                                        }}
                                    >
                                        {l.action}
                                    </span>
                                    {l.entity} • {l.entityId}
                                </div>
                                <div className="opacity-70">
                                    {new Date(l.createdAt).toLocaleString()}
                                </div>
                            </div>
                            {l.meta && (
                                <pre className="mt-2 overflow-auto rounded bg-neutral-900/40 p-2 text-xs">
                                    {JSON.stringify(l.meta, null, 2)}
                                </pre>
                            )}
                        </div>
                    ))}

                    <div className="pt-2">
                        <button
                            className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-50"
                            onClick={() => nextCursor && load(nextCursor)}
                            disabled={!nextCursor || loading}
                        >
                            {loading ? 'Loading…' : nextCursor ? 'Load more' : 'No more'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

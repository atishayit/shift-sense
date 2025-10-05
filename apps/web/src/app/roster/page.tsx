function fmt(dt: string) {
  return new Date(dt).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
}
async function getLatestSchedule() {
  const list = await fetch('http://localhost:4000/api/orgs/demo/schedules', { cache: 'no-store' }).then(r=>r.json());
  if (!list.length) return null;
  const full = await fetch(`http://localhost:4000/api/schedules/${list[0].id}`, { cache: 'no-store' }).then(r=>r.json());
  return full;
}
export default async function Roster() {
  const sched = await getLatestSchedule();
  if (!sched) return <main className="p-6">No schedule.</main>;
  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roster • {new Date(sched.weekStart).toDateString()}</h1>
        <div className="text-lg">Total cost: ${Number(sched.totalCost ?? 0).toFixed(2)}</div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sched.shifts.map((s: any) => (
          <div key={s.id} className="border rounded p-3 space-y-1">
            <div className="font-medium">{s.role.name} @ {s.location.name}</div>
            <div className="text-sm text-gray-600">{fmt(s.start)} → {fmt(s.end)}</div>
            <div className="text-sm">Required: {s.required}</div>
            <ul className="text-sm list-disc pl-5">
              {s.assignments?.length
                ? s.assignments.map((a: any) => (
                    <li key={a.id}>
                      {a.employee.code} — {a.employee.firstName} {a.employee.lastName} (${Number(a.cost).toFixed(2)})
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

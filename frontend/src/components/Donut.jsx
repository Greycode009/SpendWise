/**
 * Lightweight SVG donut (no chart library) so the dashboard stays fast;
 * the full Recharts bundle is only loaded on the Insights screen.
 * rows: [{ categoryId, total, color }]
 */
export default function Donut({ rows, size = 128, thickness = 0.16, children }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const r = 50 - (thickness * 100) / 2;
  const c = 2 * Math.PI * r;
  const gap = rows.length > 1 ? 1.2 : 0; // small gap between slices, in circumference units
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth={thickness * 100} className="stroke-slate-200 dark:stroke-slate-800" />
        {total > 0 &&
          rows.map((row) => {
            const len = (row.total / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={row.categoryId ?? 'none'}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={row.color || '#94a3b8'}
                strokeWidth={thickness * 100}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

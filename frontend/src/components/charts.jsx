import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, fromMinor } from '@spendwise/shared';
import { useCurrency } from '../hooks/useSession.js';
import { monthLabel } from '../utils/format.js';

/** Donut of category shares. rows: [{ categoryId, total, color, name }] */
export function CategoryDonut({ rows, size = 160, children }) {
  const data = rows.length ? rows : [{ categoryId: 'none', total: 1, color: '#e2e8f0', name: 'None' }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={rows.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((r) => (
              <Cell key={r.categoryId ?? 'uncat'} fill={r.color || '#94a3b8'} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

function MoneyTooltip({ active, payload, label, labelPrefix = '' }) {
  const currency = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="mb-1 font-semibold">{label && /^\d{4}-\d{2}$/.test(label) ? monthLabel(label) : `${labelPrefix}${label}`}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="num flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: {formatMoney(Math.round(p.value * 100), currency)}
        </p>
      ))}
    </div>
  );
}

/** Income vs expense per month. rows: monthlyTotals() output */
export function MonthlyBars({ rows, height = 220 }) {
  const currency = useCurrency();
  const data = rows.map((r) => ({ month: r.month, income: fromMinor(r.income), expense: fromMinor(r.expense) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={3}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
          tickFormatter={(m) => monthLabel(m, 'short').split(' ')[0]}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
          tickFormatter={(v) => formatMoney(Math.round(v * 100), currency, { compact: true })}
        />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} />
        <Bar dataKey="income" name="Income" fill="var(--color-income)" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        <Bar dataKey="expense" name="Expense" fill="var(--color-expense)" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Daily spending in a month. rows: dailyExpenses() output */
export function DailyBars({ rows, height = 140 }) {
  const data = rows.map((r) => ({ day: Number(r.date.slice(8)), expense: fromMinor(r.expense), date: r.date }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="day" tickLine={false} axisLine={false} interval={4} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.55 }} />
        <Tooltip content={<MoneyTooltip labelPrefix="Day " />} cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} />
        <Bar dataKey="expense" name="Spent" fill="var(--color-expense)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

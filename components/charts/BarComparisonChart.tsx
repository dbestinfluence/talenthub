type BarItem = {
  label: string;
  value: number;
};

type BarComparisonChartProps = {
  title: string;
  subtitle?: string;
  data: BarItem[];
  barClassName?: string;
};

export default function BarComparisonChart({
  title,
  subtitle,
  data,
  barClassName = "bg-emerald-500",
}: BarComparisonChartProps) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </header>

      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="text-slate-500">{item.value}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${barClassName}`}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

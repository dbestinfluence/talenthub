type DonutQualityChartProps = {
  title: string;
  subtitle?: string;
  pass: number;
  fail: number;
};

export default function DonutQualityChart({
  title,
  subtitle,
  pass,
  fail,
}: DonutQualityChartProps) {
  const total = pass + fail || 1;
  const radius = 54;
  const stroke = 18;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const passRatio = pass / total;
  const passStroke = passRatio * circumference;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </header>

      <div className="flex items-center justify-between gap-4">
        <svg height="140" width="140" viewBox="0 0 140 140" className="shrink-0">
          <g transform="rotate(-90 70 70)">
            <circle
              stroke="#e2e8f0"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx="70"
              cy="70"
            />
            <circle
              stroke="#10b981"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={`${passStroke} ${circumference - passStroke}`}
              strokeLinecap="round"
              r={normalizedRadius}
              cx="70"
              cy="70"
            />
          </g>
          <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" className="fill-slate-800 text-xl font-bold">
            {Math.round(passRatio * 100)}%
          </text>
          <text x="70" y="88" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[11px]">
            Pass Rate
          </text>
        </svg>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Pass: {pass}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span>Fail: {fail}</span>
          </div>
          <p className="text-xs text-slate-500">Total inspected: {total}</p>
        </div>
      </div>
    </article>
  );
}

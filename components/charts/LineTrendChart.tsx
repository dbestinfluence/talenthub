type LineTrendChartProps = {
  title: string;
  subtitle?: string;
  data: number[];
  labels?: string[];
  strokeClassName?: string;
};

export default function LineTrendChart({
  title,
  subtitle,
  data,
  labels,
  strokeClassName = "stroke-sky-500",
}: LineTrendChartProps) {
  const width = 420;
  const height = 180;
  const padding = 16;
  const safeData = data.length > 0 ? data : [0];

  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1;

  const points = safeData
    .map((value, index) => {
      const x =
        padding +
        (index * (width - padding * 2)) / Math.max(safeData.length - 1, 1);
      const y =
        height -
        padding -
        ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </header>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full min-w-[380px]">
          <line x1="16" y1="160" x2="404" y2="160" className="stroke-slate-200" />
          <line x1="16" y1="16" x2="16" y2="160" className="stroke-slate-200" />
          <polyline
            fill="none"
            points={points}
            className={`${strokeClassName} stroke-[3]`}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {safeData.map((value, index) => {
            const x =
              padding +
              (index * (width - padding * 2)) / Math.max(safeData.length - 1, 1);
            const y =
              height -
              padding -
              ((value - min) / range) * (height - padding * 2);

            return (
              <circle
                key={`${value}-${index}`}
                cx={x}
                cy={y}
                r="4"
                className={strokeClassName.replace("stroke", "fill")}
              />
            );
          })}
        </svg>
      </div>

      {labels && labels.length > 0 ? (
        <div className="mt-2 grid grid-cols-6 gap-2 text-center text-xs text-slate-500">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

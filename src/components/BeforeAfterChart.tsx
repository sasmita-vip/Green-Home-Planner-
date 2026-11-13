type Pair = { label: string; unit: string; before: number; after: number; format: (n: number) => string };

export function BeforeAfterChart({
  electricity,
  water,
}: {
  electricity: { before: number; after: number; format: (n: number) => string };
  water: { before: number; after: number; format: (n: number) => string };
}) {
  const pairs: Pair[] = [
    { label: 'Electricity, per year', unit: 'kWh', ...electricity },
    { label: 'Water, per day', unit: 'litres', ...water },
  ];

  return (
    <div className="space-y-7">
      {pairs.map((pair) => {
        const max = Math.max(pair.before, pair.after, 1);
        const cut = pair.before > 0 ? Math.max(0, Math.round(100 - (pair.after / pair.before) * 100)) : 0;
        return (
          <div key={pair.label}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-pine-700 dark:text-mint-100">{pair.label}</h3>
              <p className="text-xs text-pine-500 dark:text-mint-200/70">
                {cut > 0 ? `${cut}% less` : 'no change'}
              </p>
            </div>
            <dl className="mt-2 space-y-1.5">
              <div className="flex items-center gap-3">
                <dt className="w-14 shrink-0 text-[0.7rem] uppercase tracking-[0.1em] text-pine-500 dark:text-mint-200/60">Now</dt>
                <div className="h-6 flex-1 bg-pine-800/5 dark:bg-mint-100/10">
                  <div
                    className="h-full bg-pine-500/50 dark:bg-mint-200/30"
                    style={{ width: `${Math.max(2, (pair.before / max) * 100)}%` }}
                  />
                </div>
                <dd className="w-24 shrink-0 text-right text-sm tabular-nums">
                  {pair.format(pair.before)} <span className="text-xs text-pine-500 dark:text-mint-200/60">{pair.unit}</span>
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="w-14 shrink-0 text-[0.7rem] uppercase tracking-[0.1em] text-pine-500 dark:text-mint-200/60">After</dt>
                <div className="h-6 flex-1 bg-pine-800/5 dark:bg-mint-100/10">
                  <div
                    className="h-full bg-accent dark:bg-accent-light"
                    style={{ width: `${Math.max(2, (pair.after / max) * 100)}%` }}
                  />
                </div>
                <dd className="w-24 shrink-0 text-right text-sm tabular-nums">
                  {pair.format(pair.after)} <span className="text-xs text-pine-500 dark:text-mint-200/60">{pair.unit}</span>
                </dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

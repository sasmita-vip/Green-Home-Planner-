import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, request } from '../lib/api';
import type { Assumptions as Config, ConfigValue } from '../lib/types';
import { shortDate } from '../lib/format';
import { Notice, StateBlock, UnverifiedBadge } from '../components/ui';

function Meta({ item }: { item: ConfigValue }) {
  return (
    <div className="mt-1 space-y-0.5 text-xs leading-relaxed text-pine-500 dark:text-mint-200/60">
      {item.source ? <p>Source: {item.source}</p> : null}
      <p>Last checked: {shortDate(item.last_checked)}</p>
      {item.todo ? <p className="text-marigold-dark dark:text-marigold-light">{item.todo}</p> : null}
    </div>
  );
}

function Row({
  title,
  value,
  item,
  children,
}: {
  title: string;
  value?: string;
  item: ConfigValue;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b hairline py-5 md:grid-cols-[16rem_1fr] md:gap-8">
      <div className="flex flex-wrap items-start gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        {item.verified ? null : <UnverifiedBadge />}
        {value ? <p className="w-full font-display text-xl tabular-nums text-accent-dark dark:text-accent-light">{value}</p> : null}
      </div>
      <div>
        {children}
        <Meta item={item} />
      </div>
    </div>
  );
}

export function Assumptions() {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    request<Config>('/assumptions', { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) setConfig(res);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err instanceof ApiError ? err.message : 'Assumptions could not be loaded.');
      });
    return () => controller.abort();
  }, [attempt]);

  if (error) {
    return (
      <StateBlock
        kind="error"
        title="Assumptions are unavailable"
        body={error}
        action={
          <button type="button" className="btn-primary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        }
      />
    );
  }

  if (!config) return <StateBlock kind="loading" title="Loading the assumptions file…" />;

  return (
    <div className="max-w-4xl py-6">
      <header>
        <p className="label">Config version {config.version}</p>
        <h1 className="mt-2 text-[2rem] leading-tight sm:text-[2.6rem]">What the numbers rest on</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-pine-600 dark:text-mint-200/80">
          Nothing here was invented for this page. Each value is copied from the assumptions file served by the
          planner function, with its source and the date it was last checked. {config.note}
        </p>
      </header>

      <Notice tone="warn" className="mt-6" title="Read this before trusting a savings figure">
        Every value below is currently marked unverified. The Tamil Nadu slabs came from an unofficial summary and
        conflict with other published slab tables. Costs, the solar yield and the water value are placeholders.
      </Notice>

      <section className="mt-8">
        <h2 className="text-xl">Electricity tariff</h2>
        <Row
          title="Tamil Nadu domestic slabs"
          value={`${config.tariff.domestic_slabs_per_unit_inr.length} bands`}
          item={config.tariff}
        >
          <table className="w-full max-w-md text-sm">
            <caption className="sr-only">Domestic tariff slabs in rupees per unit</caption>
            <thead>
              <tr className="border-b hairline text-left text-xs uppercase tracking-[0.1em] text-pine-500 dark:text-mint-200/60">
                <th scope="col" className="py-1 font-medium">Units</th>
                <th scope="col" className="py-1 text-right font-medium">₹ per unit</th>
              </tr>
            </thead>
            <tbody>
              {config.tariff.domestic_slabs_per_unit_inr.map((slab) => (
                <tr key={slab.from_units} className="border-b hairline">
                  <td className="py-1.5 tabular-nums">
                    {slab.from_units}–{slab.to_units ?? 'above'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{slab.rate.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Row>
        <Row title="Grid emission factor" value={`${config.emissions.grid_factor_tco2_per_mwh} tCO₂/MWh`} item={config.emissions} />
        <Row
          title="Rooftop solar subsidy"
          value={`₹${config.subsidy.inr_per_kw_first_2kw}/kW first 2 kW, capped at ₹${config.subsidy.cap_inr}`}
          item={config.subsidy}
        >
          <p className="text-sm">{config.subsidy.scheme}. A rented home or one without roof access gets no subsidy in this planner.</p>
        </Row>
        <Row title="Solar yield" value={`${config.solar.yield_kwh_per_kw_per_year} kWh per kW per year`} item={config.solar} />
        <Row title="Value of water" value={`₹${config.water.value_inr_per_kilolitre} per kilolitre`} item={config.water} />
      </section>

      <section className="mt-10">
        <h2 className="text-xl">Usage model</h2>
        <div className="mt-3 border-l-[3px] border-pine-500 bg-pine-500/5 px-4 py-3 text-sm">
          <p className="font-semibold">Trained on synthetic data only.</p>
          <p className="mt-1 leading-relaxed">
            {config.usage_model.data_source}. Reported fit: MAE {config.usage_model.metrics.mae_kwh_per_month} kWh per
            month and R² {config.usage_model.metrics.r2} on {config.usage_model.metrics.test_rows} generated test rows.
            These numbers measure how well the model reproduces its own generator — they are not real-world accuracy.
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {Object.entries(config.usage_model.coefficients).map(([name, value]) => (
            <div key={name} className="border-b hairline pb-1.5">
              <dt className="text-xs text-pine-500 dark:text-mint-200/60">{name.replace(/_/g, ' ')}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-xl">Upgrade library</h2>
        <p className="mt-1 text-sm text-pine-500 dark:text-mint-200/70">
          Costs and savings per unit, before tariff and carbon are applied.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b-2 border-pine-800/40 text-left text-xs uppercase tracking-[0.1em] text-pine-500 dark:border-mint-200/40 dark:text-mint-200/60">
                <th scope="col" className="py-2 font-medium">Action</th>
                <th scope="col" className="py-2 font-medium">Cost</th>
                <th scope="col" className="py-2 text-right font-medium">kWh / yr</th>
                <th scope="col" className="py-2 text-right font-medium">Litres / day</th>
                <th scope="col" className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {config.interventions.map((item) => (
                <tr key={item.id} className="border-b hairline align-top">
                  <td className="py-2.5">
                    <span className="font-medium">{item.name}</span>
                    <span className="mt-0.5 block text-xs text-pine-500 dark:text-mint-200/60">{item.source}</span>
                  </td>
                  <td className="py-2.5 tabular-nums">
                    ₹{item.cost_inr.toLocaleString('en-IN')}
                    <span className="block text-xs text-pine-500 dark:text-mint-200/60">per {item.cost_per}</span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{item.kwh_saved_per_year_per_unit}</td>
                  <td className="py-2.5 text-right tabular-nums">{item.water_litres_saved_per_day}</td>
                  <td className="py-2.5">
                    {item.verified ? (
                      <span className="tag border-accent/50 text-accent-dark dark:text-accent-light">Verified</span>
                    ) : (
                      <UnverifiedBadge />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 border-t hairline pt-5">
        <h2 className="text-xl">Scoring weights</h2>
        <p className="mt-1 text-sm">
          Payback {config.scoring_weights.payback * 100}% · carbon {config.scoring_weights.co2 * 100}% · budget fit{' '}
          {config.scoring_weights.budget_fit * 100}%. Change these and the ranking changes.
        </p>
      </section>
    </div>
  );
}

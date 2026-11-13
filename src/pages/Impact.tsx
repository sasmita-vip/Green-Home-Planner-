import { useEffect, useState } from 'react';
import { ApiError, request } from '../lib/api';
import type { ImpactResponse } from '../lib/types';
import { DEMO_TOKEN, getOwnerToken, getSavedHousehold } from '../lib/session';
import { inr, num, oneDecimal } from '../lib/format';
import { Notice, StateBlock, UnverifiedBadge } from '../components/ui';
import { href } from '../lib/router';

export function Impact() {
  const [homes, setHomes] = useState('1000');
  const [homesInput, setHomesInput] = useState('1000');
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const householdId = getSavedHousehold();
    const query = householdId ? `homes=${homes}&household_id=${householdId}` : `homes=${homes}`;

    setLoading(true);
    setError(null);
    const load = async (): Promise<ImpactResponse> => {
      try {
        return await request<ImpactResponse>(`/impact?${query}`, { token: getOwnerToken(), signal: controller.signal });
      } catch (err) {
        // Demo households live under the shared demo token, not this browser's token.
        if (err instanceof ApiError && err.status === 404 && householdId) {
          return await request<ImpactResponse>(`/impact?${query}`, { token: DEMO_TOKEN, signal: controller.signal });
        }
        throw err;
      }
    };
    load()
      .then((res) => {
        if (!controller.signal.aborted) setData(res);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 404) {
          setError('That saved household is no longer available in this browser. Start a new plan, or use the demo.');
        } else {
          setError(err instanceof ApiError ? err.message : 'The impact estimate could not be loaded.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [homes, attempt]);

  return (
    <div className="max-w-4xl space-y-8 py-6">
      <header>
        <p className="label">If this plan spread</p>
        <h1 className="mt-2 text-[2rem] leading-tight sm:text-[2.6rem]">What {num(Number(homes) || 0)} homes could do</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-pine-600 dark:text-mint-200/80">
          One household's plan, multiplied linearly. It is arithmetic on a single profile, not a forecast of adoption,
          budgets or behaviour.
        </p>
      </header>

      <form
        className="flex flex-wrap items-end gap-3 border-y hairline py-5"
        onSubmit={(e) => {
          e.preventDefault();
          const value = Math.max(1, Math.min(100000, Number(homesInput.replace(/[^\d]/g, '')) || 1));
          setHomesInput(String(value));
          setHomes(String(value));
        }}
      >
        <div>
          <label className="label" htmlFor="homes">
            Number of homes
          </label>
          <input
            id="homes"
            inputMode="numeric"
            value={homesInput}
            onChange={(e) => setHomesInput(e.target.value.replace(/[^\d]/g, ''))}
            className="field w-40"
          />
        </div>
        <button type="submit" className="btn-primary">
          Recalculate
        </button>
        <p className="text-xs text-pine-500 dark:text-mint-200/60">Up to 1,00,000 homes.</p>
      </form>

      {loading ? <StateBlock kind="loading" title="Scaling the plan…" /> : null}

      {!loading && error ? (
        <StateBlock
          kind="error"
          title="The impact estimate is unavailable"
          body={error}
          action={
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
              <a href={href('/new')} className="btn-quiet">
                Build a plan first
              </a>
            </div>
          }
        />
      ) : null}

      {!loading && data ? (
        <>
          <dl className="grid grid-cols-1 border-t-[3px] border-pine-800/80 sm:grid-cols-2 dark:border-mint-100/70">
            {[
              { label: 'Saved per year', value: inr(data.savings_inr_per_year) },
              { label: 'Electricity avoided per year', value: `${num(data.kwh_per_year)} kWh` },
              { label: 'Water saved per year', value: `${num(data.litres_per_year)} litres` },
              { label: 'CO₂ avoided per year', value: `${oneDecimal(data.co2_tonnes_per_year)} tonnes` },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={`border-b hairline px-1 py-6 sm:px-6 ${index % 2 === 0 ? 'sm:border-r' : ''}`}
              >
                <dt className="label">{stat.label}</dt>
                <dd className="mt-1 font-display text-3xl tabular-nums sm:text-4xl">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <p className="text-pine-500 dark:text-mint-200/70">
              One home: {inr(data.per_home.savings_inr_per_year)} a year · {num(data.per_home.kwh_per_year)} kWh ·{' '}
              {num(data.per_home.litres_per_day)} L/day
            </p>
            <p className="tabular-nums">
              Upfront for all homes: <strong>{inr(data.cost_inr)}</strong>
            </p>
          </div>

          <section aria-labelledby="basis-title" className="border-t hairline pt-5">
            <h2 id="basis-title" className="text-lg">
              What this is based on
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-pine-600 dark:text-mint-200/80">
              <li>
                Profile: {data.basis.city}, {num(data.basis.home_size_sqft)} sq ft — {data.basis.source}.
              </li>
              <li>Tariff: Tamil Nadu domestic slabs (unverified) · grid factor {data.assumptions.grid_factor_tco2_per_mwh} tCO₂/MWh (unverified).</li>
              <li>Water valued at ₹{data.assumptions.water_value_inr_per_kilolitre} per kilolitre — a placeholder, not a city tariff.</li>
              <li>Assumptions version {data.assumptions.version}. {data.assumptions.note}</li>
              <li>{data.disclaimer}</li>
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <UnverifiedBadge />
              <a className="link text-sm" href={href('/assumptions')}>
                Every value, with its source and date
              </a>
            </div>
          </section>

          <Notice tone="synthetic" title="Not a forecast">
            This table multiplies one saved plan. It assumes every home adopts every selected item, which no real
            programme achieves.
          </Notice>
        </>
      ) : null}
    </div>
  );
}

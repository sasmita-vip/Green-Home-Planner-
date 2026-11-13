import { useEffect, useMemo, useState } from 'react';
import { ApiError, request, requestText } from '../lib/api';
import type { HouseholdResponse, Plan, PlanItem, PlanItemTag, PlanResponse } from '../lib/types';
import { DEMO_TOKEN, getOwnerToken } from '../lib/session';
import { href, navigate } from '../lib/router';
import { inr, num } from '../lib/format';
import { BeforeAfterChart } from '../components/BeforeAfterChart';
import { AssistantPanel } from '../components/AssistantPanel';
import { BillsPanel } from '../components/BillsPanel';
import { Notice, ScoreBar, StateBlock, UnverifiedBadge } from '../components/ui';

const tagClass: Record<PlanItemTag, string> = {
  'Quick win': 'border-accent/50 bg-accent/10 text-accent-dark dark:text-accent-light',
  'Steady return': 'border-pine-500/40 bg-pine-500/10 text-pine-600 dark:text-mint-200',
  'Long-term': 'border-pine-800/25 bg-transparent text-pine-500 dark:border-mint-200/25 dark:text-mint-200/70',
  'Over budget': 'border-clay/50 bg-clay/10 text-clay',
};

export function PlanView({ id }: { id: string }) {
  const [household, setHousehold] = useState<HouseholdResponse | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [token, setToken] = useState<string>(getOwnerToken());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let activeToken = getOwnerToken();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let data: HouseholdResponse;
        try {
          data = await request<HouseholdResponse>(`/households/${id}`, { token: activeToken, signal: controller.signal });
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            activeToken = DEMO_TOKEN;
            data = await request<HouseholdResponse>(`/households/${id}`, { token: activeToken, signal: controller.signal });
          } else {
            throw err;
          }
        }

        let nextPlan: Plan;
        let nextPlanId: string;
        if (data.latest_plan) {
          nextPlan = {
            assumptions_version: '',
            budget_inr: data.household.budget_inr,
            items: data.latest_plan.items,
            totals: data.latest_plan.totals,
            disclaimer: '',
          };
          nextPlanId = data.latest_plan.id;
        } else {
          const created = await request<PlanResponse>('/plan', {
            method: 'POST',
            token: activeToken,
            body: { household_id: id },
            signal: controller.signal,
          });
          nextPlan = created.plan;
          nextPlanId = created.saved_plan_id;
        }

        if (controller.signal.aborted) return;
        setHousehold(data);
        setToken(activeToken);
        setPlan(nextPlan);
        setPlanId(nextPlanId);
        setSelected(new Set(nextPlan.items.filter((i) => i.selected).map((i) => i.id)));
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof ApiError
            ? err.code === 'not_found' || err.status === 404
              ? 'This plan link is not available in this browser. Households are private to the browser that made them.'
              : err.message
            : 'The plan could not be loaded.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [id, attempt]);

  const derived = useMemo(() => {
    if (!plan) return null;
    let running = 0;
    const items = plan.items.map((item) => {
      const isSelected = selected.has(item.id);
      if (isSelected) running += item.cost_inr;
      const over = isSelected && running > plan.budget_inr;
      return { ...item, isSelected, displayTag: (over ? 'Over budget' : item.tag) as PlanItemTag };
    });
    const chosen = items.filter((i) => i.isSelected);
    const cost = chosen.reduce((s, i) => s + i.cost_inr, 0);
    const savings = chosen.reduce((s, i) => s + i.savings_inr_per_year, 0);
    const co2 = chosen.reduce((s, i) => s + i.co2_kg_per_year, 0);
    const litres = chosen.reduce((s, i) => s + i.litres_per_day, 0);
    const kwh = chosen.reduce((s, i) => s + i.kwh_per_year, 0);
    return {
      items,
      cost,
      savings,
      co2,
      litres,
      kwh,
      payback: savings > 0 ? cost / savings : null,
      remaining: plan.budget_inr - cost,
      fill: plan.budget_inr > 0 ? Math.min(100, (cost / plan.budget_inr) * 100) : 0,
    };
  }, [plan, selected]);

  const toggle = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const exportPlan = async () => {
    if (!planId) return;
    setExportError(null);
    try {
      const html = await requestText(`/export/${planId}`, token);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) setExportError('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'The printable plan could not be built.');
    }
  };

  if (loading) {
    return (
      <div className="py-8">
        <StateBlock kind="loading" title="Building your ranked plan…" />
      </div>
    );
  }

  if (error || !household || !plan || !derived) {
    return (
      <div className="py-8">
        <StateBlock
          kind="error"
          title="We could not show this plan"
          body={error ?? 'Something went missing on the way.'}
          action={
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
              <a className="btn-quiet" href={href('/new')}>
                Start a new plan
              </a>
            </div>
          }
        />
      </div>
    );
  }

  const h = household.household;
  const electricityBefore = h.electricity_kwh_month * 12;
  const electricityAfter = Math.max(0, electricityBefore - derived.kwh);
  const waterBefore = h.water_litres_day;
  const waterAfter = Math.max(0, waterBefore - derived.litres);
  const overBudget = derived.remaining < 0;

  return (
    <div className="space-y-10 py-6">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-pine-500 dark:text-mint-200/60">
          <span>{h.city}</span>
          <span aria-hidden="true">·</span>
          <span>{num(h.home_size_sqft)} sq ft</span>
          <span aria-hidden="true">·</span>
          <span>{h.people} people</span>
          <span aria-hidden="true">·</span>
          <span>{h.ownership}</span>
          <span aria-hidden="true">·</span>
          <span>{h.roof_access ? 'roof access' : 'no roof access'}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[2rem] leading-tight sm:text-[2.6rem]">Your ranked plan</h1>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-quiet text-xs" onClick={() => void exportPlan()}>
              Print / save as PDF
            </button>
            <a href={href('/new')} className="btn-quiet text-xs">
              New plan
            </a>
          </div>
        </div>
        {household.is_demo ? (
          <p className="mt-2 text-sm text-pine-500 dark:text-mint-200/70">
            Demo household with invented figures. You can tick items and ask questions, but this profile cannot be
            edited or deleted.
          </p>
        ) : null}
        {exportError ? (
          <Notice tone="error" className="mt-3">
            {exportError}
          </Notice>
        ) : null}
      </header>

      <Notice tone="warn" title="Tariff figures are unverified">
        The Tamil Nadu domestic slabs behind these savings come from an unofficial summary and conflict with other
        sources. Until the official TNPDCL order is checked, read every ₹ figure as a sketch.{' '}
        <a className="link" href={href('/assumptions')}>
          See the assumptions
        </a>
        .
      </Notice>

      <section aria-label="Plan summary" className="grid grid-cols-1 divide-y divide-pine-800/15 border-y-[3px] border-pine-800/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:border-mint-100/70 dark:divide-mint-200/20">
        <div className="px-1 py-5 sm:px-5">
          <p className="label">Saved per year</p>
          <p className="mt-1 font-display text-3xl tabular-nums">{inr(derived.savings)}</p>
          <p className="mt-1 text-xs text-pine-500 dark:text-mint-200/60">Across {derived.items.filter((i) => i.isSelected).length} selected items</p>
        </div>
        <div className="px-1 py-5 sm:px-5">
          <p className="label">CO₂ avoided per year</p>
          <p className="mt-1 font-display text-3xl tabular-nums">
            {num(derived.co2)} <span className="text-base">kg</span>
          </p>
          <p className="mt-1 text-xs text-pine-500 dark:text-mint-200/60">Grid factor {num(675)} kg per MWh</p>
        </div>
        <div className="px-1 py-5 sm:px-5">
          <p className="label">Average payback</p>
          <p className="mt-1 font-display text-3xl tabular-nums">
            {derived.payback === null ? '—' : derived.payback.toFixed(1)} <span className="text-base">yrs</span>
          </p>
          <p className="mt-1 text-xs text-pine-500 dark:text-mint-200/60">Cost divided by yearly savings</p>
        </div>
      </section>

      <section aria-labelledby="budget-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="budget-title" className="text-lg">
            Budget
          </h2>
          <p className="text-sm tabular-nums text-pine-600 dark:text-mint-200/80">
            {inr(derived.cost)} of {inr(plan.budget_inr)}
            <span className={overBudget ? 'ml-2 font-medium text-clay' : 'ml-2 text-pine-500 dark:text-mint-200/60'}>
              {overBudget ? `${inr(-derived.remaining)} over` : `${inr(derived.remaining)} left`}
            </span>
          </p>
        </div>
        <div
          className="mt-2 h-3 w-full bg-pine-800/10 dark:bg-mint-100/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={plan.budget_inr}
          aria-valuenow={Math.round(derived.cost)}
          aria-label="Budget used"
        >
          <div className="h-full bg-marigold transition-[width] duration-300" style={{ width: `${derived.fill}%` }} />
        </div>
      </section>

      <section aria-labelledby="items-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="items-title" className="text-lg">
            Ranked actions
          </h2>
          <span className="text-xs text-pine-500 dark:text-mint-200/60">Score = payback 40% · carbon 30% · budget fit 30%</span>
        </div>

        {derived.items.length === 0 ? (
          <StateBlock
            kind="empty"
            title="No upgrades fit this home yet"
            body="Nothing in the library applied to this profile. Check the appliance counts and roof access, then rebuild the plan."
            action={
              <a className="btn-primary" href={href('/new')}>
                Edit the household
              </a>
            }
          />
        ) : (
          <ul className="mt-2 divide-y divide-pine-800/15 dark:divide-mint-200/15">
            {derived.items.map((item) => (
              <PlanRow key={item.id} item={item} onToggle={() => toggle(item.id)} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="chart-title" className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 id="chart-title" className="text-lg">
            Before and after
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-pine-500 dark:text-mint-200/70">
            Based only on the items ticked above. A ticked water item may not cut your metered use as much as the
            estimate suggests.
          </p>
        </div>
        <BeforeAfterChart
          electricity={{ before: electricityBefore, after: electricityAfter, format: num }}
          water={{ before: waterBefore, after: waterAfter, format: num }}
        />
      </section>

      <AssistantPanel householdId={household.id} token={token} />
      <BillsPanel householdId={household.id} token={token} />

      <div className="border-t hairline pt-4 text-xs leading-relaxed text-pine-500 dark:text-mint-200/60">
        <UnverifiedBadge /> Planning estimate, not a quote or a guarantee. Only Chennai and Coimbatore are supported.
        Usage predictions use a model trained on synthetic data.{' '}
        <button type="button" className="link" onClick={() => navigate('/responsible-ai')}>
          How this was built
        </button>
      </div>
    </div>
  );
}

function PlanRow({
  item,
  onToggle,
}: {
  item: PlanItem & { isSelected: boolean; displayTag: PlanItemTag };
  onToggle: () => void;
}) {
  return (
    <li className="py-4">
      <div className="grid gap-3 sm:grid-cols-[2.5rem_1fr_auto] sm:gap-5">
        <p className="font-display text-2xl leading-none text-accent/80 dark:text-accent-light/80" aria-label={`Rank ${item.rank}`}>
          {String(item.rank).padStart(2, '0')}
        </p>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[1.05rem] font-semibold leading-snug text-pine-800 dark:text-mint-50">{item.name}</h3>
            <span className={`tag ${tagClass[item.displayTag]}`}>{item.displayTag}</span>
            {item.subsidy_inr > 0 ? (
              <span className="text-[0.7rem] uppercase tracking-[0.1em] text-accent dark:text-accent-light">
                {inr(item.subsidy_inr)} subsidy
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-pine-600 dark:text-mint-200/80">{item.reason}</p>
          <p className="mt-0.5 text-xs text-pine-500 dark:text-mint-200/60">{item.note}</p>

          <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-pine-500 dark:text-mint-200/55">Cost</dt>
              <dd className="tabular-nums">{inr(item.cost_inr)}</dd>
            </div>
            <div>
              <dt className="text-pine-500 dark:text-mint-200/55">Saves / year</dt>
              <dd className="tabular-nums">{inr(item.savings_inr_per_year)}</dd>
            </div>
            <div>
              <dt className="text-pine-500 dark:text-mint-200/55">Payback</dt>
              <dd className="tabular-nums">{item.payback_years > 0 ? `${item.payback_years} yrs` : 'no rupee payback'}</dd>
            </div>
            <div>
              <dt className="text-pine-500 dark:text-mint-200/55">CO₂ / year</dt>
              <dd className="tabular-nums">
                {num(item.co2_kg_per_year)} kg{item.litres_per_day > 0 ? ` · ${num(item.litres_per_day)} L/day` : ''}
              </dd>
            </div>
          </dl>

          <div className="mt-2.5">
            <ScoreBar score={item.score} />
          </div>
        </div>

        <div className="sm:pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.isSelected}
              onChange={onToggle}
              className="h-4 w-4 accent-[#2f6b4f]"
              aria-label={`In my plan: ${item.name}`}
            />
            In my plan
          </label>
        </div>
      </div>
    </li>
  );
}

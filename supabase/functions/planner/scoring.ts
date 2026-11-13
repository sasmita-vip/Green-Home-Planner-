import assumptions from "./assumptions.json" with { type: "json" };
import { buildCandidates, type Household } from "./interventions.ts";
import { rateForUnits } from "./tariff.ts";

export type PlanItem = {
  id: string;
  name: string;
  rank: number;
  gross_cost_inr: number;
  cost_inr: number;
  subsidy_inr: number;
  savings_inr_per_year: number;
  kwh_per_year: number;
  litres_per_day: number;
  co2_kg_per_year: number;
  payback_years: number;
  score: number;
  tag: "Quick win" | "Steady return" | "Long-term" | "Over budget";
  selected: boolean;
  reason: string;
  note: string;
};

export type Plan = {
  assumptions_version: string;
  budget_inr: number;
  items: PlanItem[];
  totals: {
    selected_count: number;
    cost_inr: number;
    savings_inr_per_year: number;
    co2_kg_per_year: number;
    litres_per_day: number;
    average_payback_years: number | null;
    remaining_budget_inr: number;
  };
  disclaimer: string;
};

const weights = assumptions.scoring_weights;
const gridFactor = assumptions.emissions.grid_factor_tco2_per_mwh;
const waterValue = assumptions.water.value_inr_per_kilolitre;

export const DISCLAIMER =
  "Planning estimate, not a guarantee or a quote. Tariffs, costs and factors are placeholders until verified.";

const round = (n: number, places = 0) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

export function buildPlan(h: Household): Plan {
  const rate = rateForUnits(h.electricity_kwh_month);
  const candidates = buildCandidates(h).filter((c) => c.applicable);

  const scored = candidates.map((c) => {
    const kwhYear = c.kwh_per_year;
    const savings = kwhYear * rate + (c.litres_per_day * 365 / 1000) * waterValue;
    const netCost = Math.max(0, c.gross_cost_inr - c.subsidy_inr);
    const payback = savings > 0 ? netCost / savings : Infinity;
    return { c, kwhYear, savings, netCost, payback };
  });

  const maxCo2 = Math.max(1, ...scored.map((s) => s.kwhYear * gridFactor));

  const withScore = scored.map((s) => {
    const paybackScore = Math.max(0, 1 - Math.min(s.payback, 15) / 15);
    const co2Score = (s.kwhYear * gridFactor) / maxCo2;
    const affordability = h.budget_inr > 0 ? Math.max(0, 1 - s.netCost / h.budget_inr) : 0;
    const score = weights.payback * paybackScore + weights.co2 * co2Score + weights.budget_fit * affordability;
    return { ...s, score };
  });

  withScore.sort((a, b) => b.score - a.score);

  let spent = 0;
  const items: PlanItem[] = withScore.map((s, index) => {
    const fits = spent + s.netCost <= h.budget_inr;
    if (fits) spent += s.netCost;
    const payback = round(s.payback, 1);
    const tag: PlanItem["tag"] = !fits
      ? "Over budget"
      : s.payback <= 2
      ? "Quick win"
      : s.payback <= 6
      ? "Steady return"
      : "Long-term";
    const reason = Number.isFinite(s.payback)
      ? `Pays back in about ${payback} years and saves about Rs ${round(s.savings)} a year.`
      : "Helps water use; no rupee saving is counted yet.";
    return {
      id: s.c.id,
      name: s.c.name,
      rank: index + 1,
      gross_cost_inr: round(s.c.gross_cost_inr),
      cost_inr: round(s.netCost),
      subsidy_inr: round(s.c.subsidy_inr),
      savings_inr_per_year: round(s.savings),
      kwh_per_year: round(s.kwhYear),
      litres_per_day: s.c.litres_per_day,
      co2_kg_per_year: round(s.kwhYear * gridFactor),
      payback_years: Number.isFinite(s.payback) ? payback : 0,
      score: round(s.score, 3),
      tag,
      selected: fits,
      reason,
      note: s.c.note,
    };
  });

  const selected = items.filter((i) => i.selected);
  const costTotal = selected.reduce((sum, i) => sum + i.cost_inr, 0);
  const savingsTotal = selected.reduce((sum, i) => sum + i.savings_inr_per_year, 0);

  return {
    assumptions_version: assumptions.version,
    budget_inr: h.budget_inr,
    items,
    totals: {
      selected_count: selected.length,
      cost_inr: round(costTotal),
      savings_inr_per_year: round(savingsTotal),
      co2_kg_per_year: round(selected.reduce((sum, i) => sum + i.co2_kg_per_year, 0)),
      litres_per_day: selected.reduce((sum, i) => sum + i.litres_per_day, 0),
      average_payback_years: savingsTotal > 0 ? round(costTotal / savingsTotal, 1) : null,
      remaining_budget_inr: round(h.budget_inr - costTotal),
    },
    disclaimer: DISCLAIMER,
  };
}

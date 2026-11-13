/**
 * Engine tests for the planner (tariff, scoring, budget fill, solar rules, subsidy cap).
 * Run with a TypeScript runner that supports JSON import attributes, e.g.
 *   npx --yes tsx supabase/functions/planner/tests/engine.test.ts
 */
import { rateForUnits, monthlyBillInr } from "../tariff.ts";
import { buildPlan } from "../scoring.ts";
import { buildCandidates, type Household } from "../interventions.ts";
import { scaleImpact } from "../impact.ts";
import { isSummerMonth, predictUsage } from "../usage.ts";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const base: Household = {
  city: "Chennai",
  home_size_sqft: 1000,
  people: 4,
  appliances: { ac: 1, fan: 3, geyser: 1, pump: 0 },
  electricity_kwh_month: 300,
  water_litres_day: 500,
  budget_inr: 60000,
  roof_access: true,
  ownership: "owned",
};

// Tariff
eq("slab rate at 100 units", rateForUnits(100), 4.95);
eq("slab rate at 201 units", rateForUnits(201), 6.65);
eq("slab rate at 500 units", rateForUnits(500), 11.05);
eq("slab rate above 500 units", rateForUnits(700), 12.15);
eq("bill for 100 units", monthlyBillInr(100), 495);
eq("bill for 250 units", monthlyBillInr(250), 1322.5);
eq("bill for 0 units", monthlyBillInr(0), 0);
check("bill is monotonic", monthlyBillInr(400) > monthlyBillInr(300));

// Scoring and budget fill
const plan = buildPlan(base);
check("plan has items", plan.items.length > 0);
check(
  "items are ranked by descending score",
  plan.items.every((item, i) => i === 0 || plan.items[i - 1].score >= item.score),
);
check("ranks are sequential", plan.items.every((item, i) => item.rank === i + 1));
const selected = plan.items.filter((i) => i.selected);
check("selected cost stays inside budget", selected.reduce((s, i) => s + i.cost_inr, 0) <= base.budget_inr + 0.01);
check("over-budget items are tagged", plan.items.filter((i) => !i.selected).every((i) => i.tag === "Over budget"));
check("tags are from the allowed set", plan.items.every((i) => ["Quick win", "Steady return", "Long-term", "Over budget"].includes(i.tag)));
check(
  "totals equal the selected sum",
  plan.totals.savings_inr_per_year === selected.reduce((s, i) => s + i.savings_inr_per_year, 0),
);

// Solar applicability
const rented = buildPlan({ ...base, ownership: "rented" });
check("rented home gets no rooftop solar", !rented.items.some((i) => i.id === "rooftop_solar"));
const noRoof = buildPlan({ ...base, roof_access: false });
check("no roof access means no rooftop solar", !noRoof.items.some((i) => i.id === "rooftop_solar"));
const owned = buildPlan({ ...base, roof_access: true, ownership: "owned" });
check("owned home with roof gets rooftop solar", owned.items.some((i) => i.id === "rooftop_solar"));

// Subsidy cap
const bigUse = { ...base, electricity_kwh_month: 900 };
const solarCandidates = buildCandidates(bigUse).filter((c) => c.id === "rooftop_solar");
check("subsidy never exceeds the cap", solarCandidates.every((c) => c.subsidy_inr <= 78000), JSON.stringify(solarCandidates));
const rentedCandidates = buildCandidates({ ...bigUse, ownership: "rented" }).filter((c) => c.id === "rooftop_solar");
check("no subsidy for a rented roof", rentedCandidates.every((c) => c.subsidy_inr === 0));

// Impact scaling
const impact = scaleImpact(plan.totals, 1000, 1200);
eq("impact scales savings", impact.savings_inr_per_year, Math.round(plan.totals.savings_inr_per_year * 1000));
eq("impact scales kWh", impact.kwh_per_year, 1_200_000);
eq("impact keeps one home", impact.per_home.savings_inr_per_year, plan.totals.savings_inr_per_year);

// Usage model (synthetic)
check("summer months are flagged", isSummerMonth(4) && isSummerMonth(6) && !isSummerMonth(10));
const usage = predictUsage(base, 5);
check("prediction is positive", usage.predicted_kwh > 0);
check("model is labelled synthetic", usage.data_source.startsWith("SYNTHETIC"));
check("metrics are labelled synthetic", String(usage.metrics.data_source).startsWith("SYNTHETIC"));

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`OK ${passed} engine checks passed`);

import assumptions from "./assumptions.json" with { type: "json" };
import type { Plan } from "./scoring.ts";

export const MAX_HOMES = 100000;

export function scaleImpact(totals: Plan["totals"], homes: number, kwhPerYear = 0) {
  return {
    homes,
    savings_inr_per_year: Math.round(totals.savings_inr_per_year * homes),
    kwh_per_year: Math.round(kwhPerYear * homes),
    co2_tonnes_per_year: Math.round((totals.co2_kg_per_year * homes) / 1000 * 10) / 10,
    litres_per_day: Math.round(totals.litres_per_day * homes),
    litres_per_year: Math.round(totals.litres_per_day * 365 * homes),
    cost_inr: Math.round(totals.cost_inr * homes),
    per_home: {
      savings_inr_per_year: totals.savings_inr_per_year,
      kwh_per_year: kwhPerYear,
      co2_kg_per_year: totals.co2_kg_per_year,
      litres_per_day: totals.litres_per_day,
      cost_inr: totals.cost_inr,
    },
    assumptions: {
      version: assumptions.version,
      grid_factor_tco2_per_mwh: assumptions.emissions.grid_factor_tco2_per_mwh,
      water_value_inr_per_kilolitre: assumptions.water.value_inr_per_kilolitre,
      tariff_verified: assumptions.tariff.verified,
      emissions_verified: assumptions.emissions.verified,
      note: "Scales one household's plan linearly. Real homes differ in use, roofs and adoption rates.",
    },
    disclaimer: "Planning estimate, not a guarantee or a quote.",
  };
}

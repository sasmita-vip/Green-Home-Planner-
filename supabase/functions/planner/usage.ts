import assumptions from "./assumptions.json" with { type: "json" };
import type { Household } from "./interventions.ts";

const model = assumptions.usage_model;
const coef = model.coefficients as Record<string, number>;

export function isSummerMonth(month: number): boolean {
  return month >= 3 && month <= 6;
}

export function predictUsage(h: Household, month: number) {
  const summer = isSummerMonth(month) ? 1 : 0;
  const x: Record<string, number> = {
    intercept: 1,
    home_size_100sqft: h.home_size_sqft / 100,
    people: h.people,
    ac: h.appliances.ac,
    fan: h.appliances.fan,
    geyser: h.appliances.geyser,
    pump: h.appliances.pump,
    summer,
    ac_x_summer: h.appliances.ac * summer,
  };
  const predicted = Object.entries(coef).reduce((sum, [name, b]) => sum + b * (x[name] ?? 0), 0);
  const kwh = Math.max(0, Math.round(predicted));
  return {
    predicted_kwh: kwh,
    model_version: model.model_version,
    data_source: model.data_source,
    metrics: model.metrics,
  };
}

export function flagUnusuallyHigh(actualKwh: number, predictedKwh: number): boolean {
  return predictedKwh > 0 && actualKwh > predictedKwh * model.flag_ratio;
}

import { HttpError } from "./http.ts";
import type { Household } from "./interventions.ts";

export const SUPPORTED_CITIES = ["Chennai", "Coimbatore"] as const;
const APPLIANCE_KEYS = ["ac", "fan", "geyser", "pump"] as const;

type Fields = Record<string, unknown>;

function num(
  body: Fields,
  field: string,
  min: number,
  max: number,
  label: string,
  errors: Record<string, string>,
): number {
  const value = body[field];
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n)) {
    errors[field] = `${label} must be a whole number.`;
    return 0;
  }
  if (n < min || n > max) {
    errors[field] = `${label} must be between ${min} and ${max}.`;
    return 0;
  }
  return n;
}

export function validateHousehold(body: Fields): Household {
  const errors: Record<string, string> = {};

  const city = body.city;
  if (typeof city !== "string" || !(SUPPORTED_CITIES as readonly string[]).includes(city)) {
    errors.city = `Choose a city: ${SUPPORTED_CITIES.join(" or ")}.`;
  }
  const ownership = body.ownership;
  if (ownership !== "owned" && ownership !== "rented") {
    errors.ownership = "Choose whether you own or rent your home.";
  }
  if (typeof body.roof_access !== "boolean") {
    errors.roof_access = "Tell us whether you can access the roof.";
  }

  const appliancesInput = typeof body.appliances === "object" && body.appliances !== null
    ? body.appliances as Fields
    : {};
  const appliances = { ac: 0, fan: 0, geyser: 0, pump: 0 };
  for (const key of APPLIANCE_KEYS) {
    const max = key === "fan" ? 30 : 10;
    appliances[key] = num(appliancesInput, key, 0, max, `Number of ${key} units`, errors);
  }

  const household = {
    city: typeof city === "string" ? city : "",
    home_size_sqft: num(body, "home_size_sqft", 100, 20000, "Home size", errors),
    people: num(body, "people", 1, 30, "Number of people", errors),
    appliances,
    electricity_kwh_month: num(body, "electricity_kwh_month", 0, 10000, "Monthly electricity use", errors),
    water_litres_day: num(body, "water_litres_day", 0, 50000, "Daily water use", errors),
    budget_inr: num(body, "budget_inr", 0, 10000000, "Budget", errors),
    roof_access: body.roof_access === true,
    ownership: ownership === "owned" ? "owned" : "rented",
  } as Household;

  if (Object.keys(errors).length > 0) {
    const [field, message] = Object.entries(errors)[0];
    throw new HttpError(422, "validation_failed", message, field);
  }
  return household;
}

export function validateBill(body: Fields): {
  billing_period: string;
  units: number;
  tariff_slab: string | null;
  amount_inr: number | null;
  source: "extracted" | "manual";
  extraction_confidence: number | null;
} {
  const errors: Record<string, string> = {};
  const period = body.billing_period;
  if (typeof period !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    errors.billing_period = "Billing period must look like 2026-10.";
  }
  const units = num(body, "units", 0, 10000, "Units", errors);
  const source = body.source === "extracted" ? "extracted" : "manual";
  const amount = body.amount_inr === undefined || body.amount_inr === null || body.amount_inr === ""
    ? null
    : Number(body.amount_inr);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1000000)) {
    errors.amount_inr = "Amount must be between 0 and 10,00,000 rupees.";
  }
  const confidence = typeof body.extraction_confidence === "number" ? body.extraction_confidence : null;

  if (Object.keys(errors).length > 0) {
    const [field, message] = Object.entries(errors)[0];
    throw new HttpError(422, "validation_failed", message, field);
  }
  return {
    billing_period: period as string,
    units,
    tariff_slab: typeof body.tariff_slab === "string" ? body.tariff_slab.slice(0, 60) : null,
    amount_inr: amount,
    source,
    extraction_confidence: confidence,
  };
}

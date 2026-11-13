import assumptions from "./assumptions.json" with { type: "json" };

export type Household = {
  city: string;
  home_size_sqft: number;
  people: number;
  appliances: { ac: number; fan: number; geyser: number; pump: number };
  electricity_kwh_month: number;
  water_litres_day: number;
  budget_inr: number;
  roof_access: boolean;
  ownership: "owned" | "rented";
};

export type Candidate = {
  id: string;
  name: string;
  gross_cost_inr: number;
  subsidy_inr: number;
  kwh_per_year: number;
  litres_per_day: number;
  applicable: boolean;
  note: string;
};

const cfg = (id: string) => {
  const found = assumptions.interventions.find((i) => i.id === id);
  if (!found) throw new Error(`Missing assumption for ${id}`);
  return found;
};

const sub = assumptions.subsidy;
const solarYield = assumptions.solar.yield_kwh_per_kw_per_year;

function rooftopCost(kw: number): number {
  return Math.min(kw, 2) * sub.benchmark_inr_per_kw_first_2kw +
    Math.max(0, kw - 2) * sub.benchmark_inr_per_kw_after_2kw;
}

function rooftopSubsidy(kw: number): number {
  return Math.min(
    sub.cap_inr,
    Math.min(kw, 2) * sub.inr_per_kw_first_2kw + Math.max(0, Math.min(kw, 3) - 2) * sub.inr_per_kw_third_kw,
  );
}

export function buildCandidates(h: Household): Candidate[] {
  const annualUse = h.electricity_kwh_month * 12;
  const owned = h.ownership === "owned";

  const ledCount = Math.max(4, Math.round(h.home_size_sqft / 120));
  const led = cfg("led");

  const kw = Math.min(3, Math.max(1, Math.ceil((annualUse * 0.8) / solarYield)));
  const solarKwh = Math.min(kw * solarYield, annualUse);

  return [
    {
      id: "led",
      name: led.name,
      gross_cost_inr: ledCount * led.cost_inr,
      subsidy_inr: 0,
      kwh_per_year: ledCount * led.kwh_saved_per_year_per_unit,
      litres_per_day: 0,
      applicable: true,
      note: `${ledCount} fittings at about Rs ${led.cost_inr} each`,
    },
    {
      id: "bldc_fans",
      name: cfg("bldc_fans").name,
      gross_cost_inr: h.appliances.fan * cfg("bldc_fans").cost_inr,
      subsidy_inr: 0,
      kwh_per_year: h.appliances.fan * cfg("bldc_fans").kwh_saved_per_year_per_unit,
      litres_per_day: 0,
      applicable: h.appliances.fan > 0,
      note: `${h.appliances.fan} fans`,
    },
    {
      id: "five_star_ac",
      name: cfg("five_star_ac").name,
      gross_cost_inr: h.appliances.ac * cfg("five_star_ac").cost_inr,
      subsidy_inr: 0,
      kwh_per_year: h.appliances.ac * cfg("five_star_ac").kwh_saved_per_year_per_unit,
      litres_per_day: 0,
      applicable: h.appliances.ac > 0,
      note: `${h.appliances.ac} air conditioner(s)`,
    },
    {
      id: "solar_water_heater",
      name: cfg("solar_water_heater").name,
      gross_cost_inr: cfg("solar_water_heater").cost_inr,
      subsidy_inr: 0,
      kwh_per_year: cfg("solar_water_heater").kwh_saved_per_year_per_unit,
      litres_per_day: 0,
      applicable: h.appliances.geyser > 0 && h.roof_access,
      note: "Needs a geyser and roof access",
    },
    {
      id: "rooftop_solar",
      name: cfg("rooftop_solar").name,
      gross_cost_inr: rooftopCost(kw),
      subsidy_inr: owned && h.roof_access ? rooftopSubsidy(kw) : 0,
      kwh_per_year: solarKwh,
      litres_per_day: 0,
      applicable: h.roof_access && owned,
      note: `Sized at ${kw} kW. Needs your own roof and electricity connection`,
    },
    {
      id: "rainwater_harvesting",
      name: cfg("rainwater_harvesting").name,
      gross_cost_inr: cfg("rainwater_harvesting").cost_inr,
      subsidy_inr: 0,
      kwh_per_year: 0,
      litres_per_day: cfg("rainwater_harvesting").water_litres_saved_per_day,
      applicable: h.roof_access,
      note: "Needs roof access for collection",
    },
    {
      id: "greywater_reuse",
      name: cfg("greywater_reuse").name,
      gross_cost_inr: cfg("greywater_reuse").cost_inr,
      subsidy_inr: 0,
      kwh_per_year: 0,
      litres_per_day: cfg("greywater_reuse").water_litres_saved_per_day,
      applicable: owned,
      note: "Usually needs owner approval for plumbing changes",
    },
    {
      id: "aerators_dual_flush",
      name: cfg("aerators_dual_flush").name,
      gross_cost_inr: cfg("aerators_dual_flush").cost_inr,
      subsidy_inr: 0,
      kwh_per_year: 0,
      litres_per_day: cfg("aerators_dual_flush").water_litres_saved_per_day,
      applicable: true,
      note: "Fittings for taps and toilets",
    },
    {
      id: "leak_fixing",
      name: cfg("leak_fixing").name,
      gross_cost_inr: cfg("leak_fixing").cost_inr,
      subsidy_inr: 0,
      kwh_per_year: 0,
      litres_per_day: cfg("leak_fixing").water_litres_saved_per_day,
      applicable: true,
      note: "Plumber visit to fix dripping taps and cisterns",
    },
    {
      id: "standby_cuts",
      name: cfg("standby_cuts").name,
      gross_cost_inr: cfg("standby_cuts").cost_inr,
      subsidy_inr: 0,
      kwh_per_year: cfg("standby_cuts").kwh_saved_per_year_per_unit,
      litres_per_day: 0,
      applicable: true,
      note: "Switch off idle TVs, set-top boxes and chargers",
    },
  ];
}

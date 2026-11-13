export type ApplianceCounts = { ac: number; fan: number; geyser: number; pump: number };

export type HouseholdInput = {
  city: string;
  home_size_sqft: number;
  people: number;
  appliances: ApplianceCounts;
  electricity_kwh_month: number;
  water_litres_day: number;
  budget_inr: number;
  roof_access: boolean;
  ownership: 'owned' | 'rented';
};

export type PlanItemTag = 'Quick win' | 'Steady return' | 'Long-term' | 'Over budget';

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
  tag: PlanItemTag;
  selected: boolean;
  reason: string;
  note: string;
};

export type PlanTotals = {
  selected_count: number;
  cost_inr: number;
  savings_inr_per_year: number;
  co2_kg_per_year: number;
  litres_per_day: number;
  average_payback_years: number | null;
  remaining_budget_inr: number;
};

export type Plan = {
  assumptions_version: string;
  budget_inr: number;
  items: PlanItem[];
  totals: PlanTotals;
  disclaimer: string;
};

export type PlanResponse = { household_id: string; saved_plan_id: string; plan: Plan };

export type HouseholdResponse = {
  id: string;
  household: HouseholdInput;
  is_demo: boolean;
  latest_plan_id: string | null;
  latest_plan: { id: string; items: PlanItem[]; totals: PlanTotals } | null;
};

export type DemoHousehold = {
  id: string;
  label: string;
  city: string;
  home_size_sqft: number;
  ownership: string;
};

export type ConfigValue = {
  source?: string;
  last_checked?: string;
  verified?: boolean;
  todo?: string;
};

export type Assumptions = {
  version: string;
  last_checked: string;
  note: string;
  tariff: ConfigValue & {
    state: string;
    domestic_slabs_per_unit_inr: { from_units: number; to_units: number | null; rate: number }[];
  };
  emissions: ConfigValue & { grid_factor_tco2_per_mwh: number };
  subsidy: ConfigValue & {
    scheme: string;
    inr_per_kw_first_2kw: number;
    inr_per_kw_third_kw: number;
    cap_inr: number;
    benchmark_inr_per_kw_first_2kw: number;
    benchmark_inr_per_kw_after_2kw: number;
  };
  water: ConfigValue & { value_inr_per_kilolitre: number };
  solar: ConfigValue & { yield_kwh_per_kw_per_year: number };
  usage_model: {
    model_version: string;
    flag_ratio: number;
    data_source: string;
    coefficients: Record<string, number>;
    metrics: { data_source: string; model: string; train_rows: number; test_rows: number; mae_kwh_per_month: number; r2: number };
  };
  interventions: (ConfigValue & {
    id: string;
    name: string;
    cost_inr: number;
    cost_per: string;
    kwh_saved_per_year_per_unit: number;
    water_litres_saved_per_day: number;
  })[];
  scoring_weights: { payback: number; co2: number; budget_fit: number };
  demo_households: DemoHousehold[];
  demo_token: string;
  supported_cities: string[];
  warnings: string[];
};

export type ImpactResponse = {
  homes: number;
  savings_inr_per_year: number;
  kwh_per_year: number;
  co2_tonnes_per_year: number;
  litres_per_day: number;
  litres_per_year: number;
  cost_inr: number;
  per_home: { savings_inr_per_year: number; kwh_per_year: number; co2_kg_per_year: number; litres_per_day: number; cost_inr: number };
  assumptions: {
    version: string;
    grid_factor_tco2_per_mwh: number;
    water_value_inr_per_kilolitre: number;
    tariff_verified: boolean;
    emissions_verified: boolean;
    note: string;
  };
  disclaimer: string;
  basis: { household_id: string; city: string; home_size_sqft: number; source: string };
};

export type Prediction = {
  predicted_kwh: number;
  model_version: string;
  data_source: string;
  metrics: { mae_kwh_per_month: number; r2: number; train_rows: number; test_rows: number; data_source: string; model: string };
  month: number;
  actual_kwh: number;
  flagged_high: boolean;
  label: string;
};

export type Bill = {
  id: string;
  billing_period: string;
  units: number;
  tariff_slab: string | null;
  amount_inr: number | null;
  source: 'extracted' | 'manual';
  extraction_confidence: number | null;
  created_at: string;
};

export type ExtractedBillResponse = {
  fields: {
    billing_period: string | null;
    units: number | null;
    tariff_slab: string | null;
    amount_inr: number | null;
    confidence: number | null;
  };
  needs_review: boolean;
  privacy_notice: string;
};

export type AssistantResponse = {
  reply: string;
  used_model: boolean;
  grounded_on_plan_id: string | null;
  disclaimer: string;
};

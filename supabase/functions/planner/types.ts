import type { Household } from "./interventions.ts";
import type { Plan, PlanItem } from "./scoring.ts";

export type { Household, Plan, PlanItem };

export type HouseholdRow = Household & {
  id: string;
  owner_hash: string;
  is_demo: boolean;
  created_at?: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    field?: string;
  };
};

export type PlanResponse = {
  household_id: string;
  saved_plan_id: string;
  plan: Plan;
};

export type WhatIfOverrides = {
  budget_inr?: number;
  ownership?: "owned" | "rented";
  roof_access?: boolean;
  appliances?: Partial<Household["appliances"]>;
  electricity_kwh_month?: number;
  water_litres_day?: number;
};

export type AssistantReply = {
  reply: string;
  grounded_on_plan_id: string | null;
  used_model: boolean;
};

export type BillFields = {
  billing_period: string | null;
  units: number | null;
  tariff_slab: string | null;
  amount_inr: number | null;
  confidence: number | null;
};

import { HttpError } from "./http.ts";
import type { Household } from "./interventions.ts";
import type { Plan } from "./scoring.ts";
import { db, hashToken } from "./db.ts";

export { hashToken };

export type HouseholdRow = Household & {
  id: string;
  owner_hash: string;
  is_demo: boolean;
};

const notFound = () => new HttpError(404, "not_found", "We could not find that household.");

export async function loadOwnedHousehold(id: string, token: string | null): Promise<HouseholdRow> {
  if (!token) throw new HttpError(401, "missing_token", "Your session token is missing. Reload the page.");
  const { data, error } = await db.from("households").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  const ownerHash = await hashToken(token);
  if (data.owner_hash !== ownerHash) throw notFound();
  return data as HouseholdRow;
}

export function toHousehold(row: HouseholdRow): Household {
  return {
    city: row.city,
    home_size_sqft: row.home_size_sqft,
    people: row.people,
    appliances: row.appliances,
    electricity_kwh_month: row.electricity_kwh_month,
    water_litres_day: row.water_litres_day,
    budget_inr: row.budget_inr,
    roof_access: row.roof_access,
    ownership: row.ownership,
  };
}

export function assertWritable(row: HouseholdRow): void {
  if (row.is_demo) {
    throw new HttpError(403, "demo_read_only", "Demo households cannot be changed. Start your own plan instead.");
  }
}

export async function saveHousehold(
  household: Household,
  ownerHash: string,
  existingId: string | null,
): Promise<string> {
  const row = { ...household, owner_hash: ownerHash, updated_at: new Date().toISOString() };
  if (existingId) {
    const { data, error } = await db.from("households").update(row).eq("id", existingId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return data.id;
  }
  const { data, error } = await db.from("households").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteHousehold(id: string): Promise<void> {
  const { error } = await db.from("households").delete().eq("id", id);
  if (error) throw error;
}

export async function listBills(householdId: string) {
  const { data, error } = await db
    .from("bills")
    .select("id, billing_period, units, tariff_slab, amount_inr, source, extraction_confidence, created_at")
    .eq("household_id", householdId)
    .order("billing_period", { ascending: true })
    .limit(60);
  if (error) throw error;
  return data ?? [];
}

export async function addBill(householdId: string, bill: Record<string, unknown>) {
  const { data, error } = await db
    .from("bills")
    .insert({ ...bill, household_id: householdId })
    .select("id, billing_period, units, tariff_slab, amount_inr, source, extraction_confidence")
    .single();
  if (error) throw error;
  return data;
}

export async function savePlan(householdId: string, plan: Plan): Promise<string> {
  const { data, error } = await db
    .from("plans")
    .insert({
      household_id: householdId,
      items: plan.items,
      totals: plan.totals,
      assumptions_version: plan.assumptions_version,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function latestPlan(householdId: string): Promise<{ id: string; items: Plan["items"]; totals: Plan["totals"] } | null> {
  const { data, error } = await db
    .from("plans")
    .select("id, items, totals")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPlanById(id: string) {
  const { data, error } = await db
    .from("plans")
    .select("id, household_id, items, totals, assumptions_version, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function savePrediction(householdId: string, row: {
  predicted_kwh: number;
  actual_kwh: number;
  flagged_high: boolean;
  model_version: string;
}) {
  const { error } = await db.from("predictions").insert({ household_id: householdId, ...row });
  if (error) throw error;
}

export async function recentChat(householdId: string, limit = 10) {
  const { data, error } = await db
    .from("chat_messages")
    .select("role, content")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function saveChat(householdId: string, language: string, role: "user" | "assistant", content: string) {
  const { error } = await db.from("chat_messages").insert({ household_id: householdId, language, role, content });
  if (error) throw error;
}

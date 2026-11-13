import { createClient } from "npm:@supabase/supabase-js@2";
import type { Household } from "./interventions.ts";

export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

export const DEMO_TOKEN = "demo-public-token";

export type DemoHousehold = {
  id: string;
  label: string;
  household: Household;
};

/**
 * Two seeded demo profiles with invented figures. They are read-only for edits
 * and deletes but may create plans. Fixed ids keep links stable across deploys.
 */
export const DEMO_HOUSEHOLDS: DemoHousehold[] = [
  {
    id: "d3e0a000-0000-4000-8000-000000000001",
    label: "600 sq ft rented flat, Chennai",
    household: {
      city: "Chennai",
      home_size_sqft: 600,
      people: 3,
      appliances: { ac: 1, fan: 3, geyser: 1, pump: 0 },
      electricity_kwh_month: 320,
      water_litres_day: 480,
      budget_inr: 25000,
      roof_access: false,
      ownership: "rented",
    },
  },
  {
    id: "d3e0a000-0000-4000-8000-000000000002",
    label: "2,000 sq ft house, Coimbatore",
    household: {
      city: "Coimbatore",
      home_size_sqft: 2000,
      people: 5,
      appliances: { ac: 2, fan: 5, geyser: 2, pump: 1 },
      electricity_kwh_month: 780,
      water_litres_day: 900,
      budget_inr: 150000,
      roof_access: true,
      ownership: "owned",
    },
  },
];

export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

let seeding: Promise<void> | null = null;

async function seed(): Promise<void> {
  const owner_hash = await hashToken(DEMO_TOKEN);
  const rows = DEMO_HOUSEHOLDS.map((d) => ({
    id: d.id,
    owner_hash,
    ...d.household,
    is_demo: true,
  }));
  const { error } = await db.from("households").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

/** Idempotent, once per isolate. */
export function ensureDemoData(): Promise<void> {
  seeding ??= seed();
  return seeding;
}

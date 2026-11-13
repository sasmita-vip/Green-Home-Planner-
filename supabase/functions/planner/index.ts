import assumptions from "./assumptions.json" with { type: "json" };
import { HttpError, readJson, corsHeaders, json, errorResponse } from "./http.ts";
import { buildPlan, type Plan } from "./scoring.ts";
import type { Household } from "./interventions.ts";
import { validateHousehold, validateBill } from "./validate.ts";
import { scaleImpact, MAX_HOMES } from "./impact.ts";
import { predictUsage, flagUnusuallyHigh } from "./usage.ts";
import { claudeConfigured, callClaude, assistantSystemPrompt, assertLanguage, extractBill } from "./claude.ts";
import { DEMO_HOUSEHOLDS, DEMO_TOKEN, ensureDemoData, hashToken } from "./db.ts";
import { renderPlanHtml } from "./export.ts";
import type { WhatIfOverrides } from "./types.ts";
import {
  addBill,
  assertWritable,
  deleteHousehold,
  getPlanById,
  latestPlan,
  listBills,
  loadOwnedHousehold,
  recentChat,
  saveChat,
  saveHousehold,
  savePlan,
  savePrediction,
  toHousehold,
  type HouseholdRow,
} from "./store.ts";

const OWNER_HEADER = "x-owner-token";

function ownerToken(req: Request): string | null {
  const token = req.headers.get(OWNER_HEADER)?.trim();
  return token ? token : null;
}

function tokenOrThrow(req: Request): string {
  const token = ownerToken(req);
  if (!token || token.length < 12) {
    throw new HttpError(401, "missing_token", "This browser has no plan token yet. Reload the page and start again.");
  }
  return token;
}

function requireBodyString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(422, "validation_failed", `Send ${field}.`, field);
  }
  return value.trim();
}

function applyOverrides(h: Household, raw: unknown): Household {
  if (raw === undefined || raw === null) return h;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpError(422, "validation_failed", "what_if must be an object.", "what_if");
  }
  const o = raw as WhatIfOverrides;
  const next: Household = { ...h, appliances: { ...h.appliances } };
  const intField = (key: keyof WhatIfOverrides, min: number, max: number, label: string) => {
    const value = o[key];
    if (value === undefined) return;
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      throw new HttpError(422, "validation_failed", `${label} must be a whole number between ${min} and ${max}.`, String(key));
    }
    (next as unknown as Record<string, number>)[String(key)] = value;
  };
  intField("budget_inr", 0, 10000000, "Budget");
  intField("electricity_kwh_month", 0, 10000, "Monthly electricity use");
  intField("water_litres_day", 0, 50000, "Daily water use");
  if (o.ownership !== undefined) {
    if (o.ownership !== "owned" && o.ownership !== "rented") {
      throw new HttpError(422, "validation_failed", "Ownership must be owned or rented.", "ownership");
    }
    next.ownership = o.ownership;
  }
  if (o.roof_access !== undefined) {
    if (typeof o.roof_access !== "boolean") {
      throw new HttpError(422, "validation_failed", "roof_access must be true or false.", "roof_access");
    }
    next.roof_access = o.roof_access;
  }
  if (o.appliances && typeof o.appliances === "object") {
    for (const key of ["ac", "fan", "geyser", "pump"] as const) {
      const value = (o.appliances as Record<string, unknown>)[key];
      if (value === undefined) continue;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 30) {
        throw new HttpError(422, "validation_failed", `${key} count must be a whole number between 0 and 30.`, key);
      }
      next.appliances[key] = value;
    }
  }
  return next;
}

async function ownedPlanPlan(row: HouseholdRow, body: Record<string, unknown>): Promise<Plan> {
  const household = applyOverrides(toHousehold(row), body.what_if);
  return buildPlan(household);
}

function kwhOf(plan: Plan): number {
  return plan.items.filter((i) => i.selected).reduce((sum, i) => sum + i.kwh_per_year, 0);
}

function cannedReply(plan: Plan, household: Household): string {
  const selected = plan.items.filter((i) => i.selected);
  if (selected.length === 0) {
    return `Your plan has no items selected yet. Try a budget of at least Rs 1,000 so a quick win can fit. Every figure here is a planning estimate, not a quote.`;
  }
  const top = selected.slice(0, 3).map((i, n) =>
    `${n + 1}. ${i.name} — Rs ${i.cost_inr} upfront, about Rs ${i.savings_inr_per_year} a year, ${i.payback_years} year payback.`
  ).join("\n");
  return `From your saved plan for a ${household.home_size_sqft} sq ft home in ${household.city}:\n${top}\nTogether the ${selected.length} selected items cost about Rs ${plan.totals.cost_inr} and save about Rs ${plan.totals.savings_inr_per_year} a year, avoiding ${plan.totals.co2_kg_per_year} kg of CO2. These are planning estimates, not guarantees or quotes. (Assistant answers are generated from your plan; the language model is not configured on this deployment.)`;
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let path = url.pathname;
  const marker = path.indexOf("/planner");
  if (marker >= 0) path = path.slice(marker + "/planner".length);
  const parts = path.split("/").filter(Boolean);
  const method = req.method;
  const token = ownerToken(req);

  if (method === "GET" && parts.length === 0) {
    return json({ name: "green-home-planners", status: "ok", assumptions_version: assumptions.version });
  }

  if (method === "GET" && parts[0] === "assumptions" && parts.length === 1) {
    return json({
      ...assumptions,
      demo_households: DEMO_HOUSEHOLDS.map((d) => ({
        id: d.id,
        label: d.label,
        city: d.household.city,
        home_size_sqft: d.household.home_size_sqft,
        ownership: d.household.ownership,
      })),
      demo_token: DEMO_TOKEN,
      supported_cities: ["Chennai", "Coimbatore"],
      warnings: [
        assumptions.tariff.verified ? "" : "Tamil Nadu domestic slabs are unverified and come from an unofficial summary.",
        assumptions.emissions.verified ? "" : "The grid emission factor is unverified.",
        assumptions.usage_model.data_source.startsWith("SYNTHETIC") ? "The usage model is trained on synthetic data only." : "",
      ].filter(Boolean),
    });
  }

  // POST /households
  if (method === "POST" && parts[0] === "households" && parts.length === 1) {
    const currentToken = tokenOrThrow(req);
    const body = await readJson(req);
    const household = validateHousehold(body);
    const id = await saveHousehold(household, await hashToken(currentToken), null);
    return json({ id, household }, 201);
  }

  // Household-scoped routes
  if (parts[0] === "households" && parts.length === 2) {
    const id = parts[1];
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "not_found", "We could not find that household.");
    if (DEMO_HOUSEHOLDS.some((d) => d.id === id)) await ensureDemoData();
    const row = await loadOwnedHousehold(id, token);
    if (method === "GET") {
      const plan = await latestPlan(id);
      return json({
        id,
        household: toHousehold(row),
        is_demo: row.is_demo,
        latest_plan_id: plan?.id ?? null,
        latest_plan: plan ? { id: plan.id, items: plan.items, totals: plan.totals } : null,
      });
    }
    if (method === "DELETE") {
      assertWritable(row);
      await deleteHousehold(id);
      return json({ deleted: true });
    }
    throw new HttpError(405, "method_not_allowed", "That method is not supported on this route.");
  }

  // POST /plan
  if (method === "POST" && parts[0] === "plan" && parts.length === 1) {
    const body = await readJson(req);
    const id = requireBodyString(body, "household_id");
    const row = await loadOwnedHousehold(id, token);
    const plan = await ownedPlanPlan(row, body);
    const savedId = await savePlan(id, plan);
    return json({ household_id: id, saved_plan_id: savedId, plan }, 201);
  }

  // POST /plan/what-if
  if (method === "POST" && parts[0] === "plan" && parts[1] === "what-if" && parts.length === 2) {
    const body = await readJson(req);
    const id = requireBodyString(body, "household_id");
    if (body.what_if === undefined) {
      throw new HttpError(422, "validation_failed", "Send what_if with the values to try.", "what_if");
    }
    const row = await loadOwnedHousehold(id, token);
    const plan = await ownedPlanPlan(row, body);
    return json({ household_id: id, saved: false, plan });
  }

  // POST /predict-usage
  if (method === "POST" && parts[0] === "predict-usage" && parts.length === 1) {
    const body = await readJson(req);
    const id = requireBodyString(body, "household_id");
    const row = await loadOwnedHousehold(id, token);
    const household = toHousehold(row);
    const month = body.month === undefined ? new Date().getMonth() + 1 : Number(body.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new HttpError(422, "validation_failed", "Month must be between 1 and 12.", "month");
    }
    const prediction = predictUsage(household, month);
    const flagged = flagUnusuallyHigh(household.electricity_kwh_month, prediction.predicted_kwh);
    await savePrediction(id, {
      predicted_kwh: prediction.predicted_kwh,
      actual_kwh: household.electricity_kwh_month,
      flagged_high: flagged,
      model_version: prediction.model_version,
    });
    return json({
      ...prediction,
      month,
      actual_kwh: household.electricity_kwh_month,
      flagged_high: flagged,
      label: "Synthetic model: trained on generated data, not real households.",
    });
  }

  // GET /impact?homes=N
  if (method === "GET" && parts[0] === "impact" && parts.length === 1) {
    const homesRaw = url.searchParams.get("homes");
    const homes = homesRaw === null ? 100 : Number(homesRaw);
    if (!Number.isInteger(homes) || homes < 1 || homes > MAX_HOMES) {
      throw new HttpError(422, "validation_failed", `Number of homes must be between 1 and ${MAX_HOMES}.`, "homes");
    }
    let row: HouseholdRow;
    const householdId = url.searchParams.get("household_id");
    if (householdId) {
      row = await loadOwnedHousehold(householdId, token);
    } else {
      await ensureDemoData();
      row = await loadOwnedHousehold(DEMO_HOUSEHOLDS[1].id, DEMO_TOKEN);
    }
    const saved = await latestPlan(row.id);
    const plan: Plan = saved
      ? { assumptions_version: assumptions.version, budget_inr: row.budget_inr, items: saved.items, totals: saved.totals, disclaimer: "" }
      : buildPlan(toHousehold(row));
    return json({
      ...scaleImpact(plan.totals, homes, kwhOf(plan)),
      basis: {
        household_id: row.id,
        city: row.city,
        home_size_sqft: row.home_size_sqft,
        source: saved ? "your latest saved plan" : "a plan built now from the household profile",
      },
    });
  }

  // GET /export/:planId
  if (method === "GET" && parts[0] === "export" && parts.length === 2) {
    const row = await getPlanById(parts[1]);
    const householdRow = await loadOwnedHousehold(row.household_id, token);
    const plan: Plan = {
      assumptions_version: row.assumptions_version,
      budget_inr: householdRow.budget_inr,
      items: row.items,
      totals: row.totals,
      disclaimer: "Planning estimate, not a guarantee or a quote.",
    };
    return new Response(
      renderPlanHtml(plan, toHousehold(householdRow), {
        planId: row.id,
        created: new Date(row.created_at).toISOString().slice(0, 10),
        isDemo: householdRow.is_demo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // POST /assistant
  if (method === "POST" && parts[0] === "assistant" && parts.length === 1) {
    const body = await readJson(req);
    const id = requireBodyString(body, "household_id");
    const message = requireBodyString(body, "message");
    if (message.length > 1000) {
      throw new HttpError(422, "validation_failed", "Keep the question under 1,000 characters.", "message");
    }
    const language = assertLanguage(body.language ?? "en");
    const row = await loadOwnedHousehold(id, token);
    const household = toHousehold(row);
    const saved = await latestPlan(id);
    const plan: Plan = saved
      ? { assumptions_version: assumptions.version, budget_inr: household.budget_inr, items: saved.items, totals: saved.totals, disclaimer: "" }
      : buildPlan(household);

    await saveChat(id, language, "user", message);

    let reply: string;
    let usedModel = false;
    if (claudeConfigured()) {
      const history = await recentChat(id, 6);
      const grounding = JSON.stringify({
        household: {
          city: household.city,
          home_size_sqft: household.home_size_sqft,
          people: household.people,
          ownership: household.ownership,
          roof_access: household.roof_access,
          budget_inr: household.budget_inr,
        },
        totals: plan.totals,
        items: plan.items.map((i) => ({
          rank: i.rank,
          name: i.name,
          tag: i.tag,
          cost_inr: i.cost_inr,
          subsidy_inr: i.subsidy_inr,
          savings_inr_per_year: i.savings_inr_per_year,
          payback_years: i.payback_years,
          co2_kg_per_year: i.co2_kg_per_year,
          selected: i.selected,
          reason: i.reason,
        })),
      });
      const context = history.map((m) => `${m.role}: ${m.content}`).join("\n");
      try {
        reply = await callClaude(
          assistantSystemPrompt(language, grounding),
          [{ type: "text", text: `Conversation so far:\n${context}\n\nQuestion: ${message}` }],
        );
        usedModel = true;
      } catch (err) {
        console.error("assistant model call failed", err);
        reply = cannedReply(plan, household);
      }
    } else {
      reply = cannedReply(plan, household);
    }

    await saveChat(id, language, "assistant", reply.slice(0, 4000));
    return json({
      reply,
      used_model: usedModel,
      grounded_on_plan_id: saved?.id ?? null,
      disclaimer: "Planning estimates only, not a guarantee or a quote.",
    });
  }

  // POST /bills/extract
  if (method === "POST" && parts[0] === "bills" && parts[1] === "extract" && parts.length === 2) {
    const body = await readJson(req);
    const id = requireBodyString(body, "household_id");
    await loadOwnedHousehold(id, token);
    const image = requireBodyString(body, "image_base64");
    if (image.length > 8_000_000) {
      throw new HttpError(413, "file_too_large", "That file is too large. Keep it under 5 MB.");
    }
    const mime = typeof body.mime_type === "string" ? body.mime_type : "image/jpeg";
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(mime)) {
      throw new HttpError(422, "validation_failed", "Upload a JPG, PNG, WEBP or PDF.", "mime_type");
    }
    if (!claudeConfigured()) {
      throw new HttpError(
        503,
        "claude_not_configured",
        "Bill reading is not set up on this deployment. Enter the bill by hand instead.",
      );
    }
    let extracted;
    try {
      extracted = await extractBill(image, mime);
    } catch (err) {
      console.error("bill extraction failed", err);
      throw new HttpError(502, "extraction_failed", "We could not read that bill. Enter the values by hand.");
    }
    if (!extracted) {
      throw new HttpError(422, "extraction_empty", "We could not find units on that bill. Enter the values by hand.");
    }
    return json({
      fields: extracted,
      needs_review: true,
      privacy_notice:
        "The whole bill image is sent to the model. Personal details on it cannot be redacted before sending. Crop the image if you want to hide them.",
    });
  }

  // POST /bills  |  GET /bills
  if (parts[0] === "bills" && parts.length === 1) {
    if (method === "POST") {
      const body = await readJson(req);
      const id = requireBodyString(body, "household_id");
      await loadOwnedHousehold(id, token);
      const bill = validateBill(body);
      const saved = await addBill(id, bill);
      return json({ bill: saved }, 201);
    }
    if (method === "GET") {
      const id = url.searchParams.get("household_id");
      if (!id) throw new HttpError(422, "validation_failed", "Send household_id.", "household_id");
      await loadOwnedHousehold(id, token);
      return json({ bills: await listBills(id) });
    }
  }

  throw new HttpError(404, "route_not_found", "That route does not exist.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    return await handle(req);
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err);
    console.error("unhandled planner error", err);
    return errorResponse(new HttpError(500, "internal_error", "Something went wrong on our side. Try again."));
  }
});

import type { Plan, PlanItem } from "./types.ts";
import type { Household } from "./interventions.ts";

const esc = (value: string | number) =>
  String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

const inr = (n: number) => `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;

function row(item: PlanItem): string {
  return `<tr>
    <td class="rank">${item.rank}</td>
    <td>
      <strong>${esc(item.name)}</strong>
      <div class="note">${esc(item.note)}</div>
      <div class="note">${esc(item.reason)}</div>
    </td>
    <td class="tag">${esc(item.tag)}</td>
    <td class="num">${inr(item.cost_inr)}</td>
    <td class="num">${inr(item.savings_inr_per_year)}</td>
    <td class="num">${item.payback_years > 0 ? item.payback_years + " yrs" : "—"}</td>
    <td class="num">${item.co2_kg_per_year} kg</td>
  </tr>`;
}

export function renderPlanHtml(
  plan: Plan,
  household: Household,
  meta: { planId: string; created: string; isDemo: boolean },
): string {
  const selected = plan.items.filter((i) => i.selected);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Green Home Planners — plan for ${esc(household.city)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; color: #12291f; background: #f3f7f3; margin: 0; padding: 24px; font-size: 12px; line-height: 1.45; }
  .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 28px 30px; border-top: 6px solid #2f6b4f; }
  h1 { font-family: "Bricolage Grotesque", "Segoe UI", sans-serif; font-size: 24px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .sub { color: #4a6156; margin: 0 0 16px; }
  .strip { display: flex; gap: 18px; flex-wrap: wrap; border-top: 1px solid #cddcd2; border-bottom: 1px solid #cddcd2; padding: 10px 0; margin-bottom: 18px; }
  .strip div span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #4a6156; }
  .strip div strong { font-family: "Bricolage Grotesque", sans-serif; font-size: 17px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #4a6156; border-bottom: 1px solid #2f6b4f; padding: 6px 6px; }
  td { border-bottom: 1px solid #e2ebe4; padding: 7px 6px; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.rank { font-family: "Bricolage Grotesque", sans-serif; font-size: 14px; color: #2f6b4f; }
  td.tag { white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  .note { color: #4a6156; font-size: 10.5px; }
  .warn { border-left: 3px solid #e8a020; background: #fdf6e7; padding: 8px 10px; margin: 14px 0; }
  footer { margin-top: 18px; color: #4a6156; font-size: 10.5px; border-top: 1px solid #cddcd2; padding-top: 10px; }
  @media print { body { background: #fff; padding: 0; } .sheet { border: none; padding: 0; } }
</style>
</head>
<body>
<div class="sheet">
  <h1>Green Home Planners</h1>
  <p class="sub">${esc(household.home_size_sqft)} sq ft · ${esc(household.people)} people · ${esc(household.ownership)} · ${esc(household.city)}${
    meta.isDemo ? " · demo household (invented figures)" : ""
  }</p>

  <div class="strip">
    <div><span>Saved per year</span><strong>${inr(plan.totals.savings_inr_per_year)}</strong></div>
    <div><span>CO2 avoided / year</span><strong>${plan.totals.co2_kg_per_year} kg</strong></div>
    <div><span>Average payback</span><strong>${plan.totals.average_payback_years ?? "—"} yrs</strong></div>
    <div><span>Budget</span><strong>${inr(plan.totals.cost_inr)} of ${inr(plan.budget_inr)}</strong></div>
  </div>

  <table>
    <thead>
      <tr><th>#</th><th>Action</th><th>Tag</th><th class="num">Cost</th><th class="num">Saves / yr</th><th class="num">Payback</th><th class="num">CO2 / yr</th></tr>
    </thead>
    <tbody>${selected.map(row).join("")}</tbody>
  </table>

  <div class="warn">
    <strong>Tariff figures are unverified.</strong> The Tamil Nadu domestic slabs used here come from an unofficial
    summary and conflict with other sources. Confirm them against the official TNPDCL tariff order before acting on
    the savings numbers.
  </div>

  <footer>
    ${esc(plan.disclaimer)} Assumptions version ${esc(plan.assumptions_version)} · plan ${esc(meta.planId)} · generated ${esc(meta.created)}.
    Only Chennai and Coimbatore are supported. Usage predictions come from a model trained on synthetic data, so they
    are not a measure of real-world accuracy.
  </footer>
</div>
</body>
</html>`;
}

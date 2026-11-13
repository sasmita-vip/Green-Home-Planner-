# Green Home Planners

A ranked, explainable home-upgrade plan for Chennai and Coimbatore homes: what to do, what it costs,
what it saves, and what it does to electricity and water use.

**React + Vite + Tailwind** frontend · **Supabase Postgres** for storage · **Supabase edge function `planner`** (TypeScript) as the only backend.

## Setup

```bash
npm install
cp .env.example .env.local     # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                    # http://localhost:5173
npm run typecheck
npm run build
```

Backend:

```bash
# 1. Apply the schema (creates households, bills, plans, predictions, chat_messages)
supabase db push                # or run supabase/migrations/*.sql in the SQL editor

# 2. Optional model for the assistant and bill reading
supabase secrets set ANTHROPIC_API_KEY=... CLAUDE_MODEL=claude-sonnet-4-5

# 3. Deploy
supabase functions deploy planner
```

The function needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects. Without
`ANTHROPIC_API_KEY` the assistant answers from the plan by rule and bill reading returns `503
claude_not_configured`, which the upload screen turns into manual entry.

## Ownership model

No accounts. The browser generates a random token and sends it as `X-Owner-Token`. The server stores
only its SHA-256 hash and compares it on every household-scoped request. The two demo households are
seeded with fixed ids and the public demo token, are read-only for edits and deletes, and may create plans.

## API (error shape: `{ "error": { "code", "message", "field"? } }`)

| Route | Purpose |
| --- | --- |
| `GET /assumptions` | Config, demo households, warnings |
| `POST /households` · `GET/DELETE /households/:id` | Create, read, delete a profile |
| `POST /plan` · `POST /plan/what-if` | Ranked plan (saved) · plan with overrides (not saved) |
| `POST /predict-usage` | Synthetic-model usage prediction and "unusually high" flag |
| `GET /impact?homes=N` | Scaled ₹, kWh, litres, CO₂ for N homes |
| `GET /export/:planId` | Printable one-page HTML plan |
| `POST /assistant` | Grounded answer, rule-based fallback without a key |
| `POST /bills/extract` · `POST /bills` · `GET /bills` | Bill reading and manual entry |

## Tests

```bash
npx --yes tsx supabase/functions/planner/tests/engine.test.ts
```

Covers tariff slabs, bill bands, scoring order, budget fill, "Over budget" tagging, rooftop-solar
applicability (rented / no roof), the subsidy cap and impact scaling. 27 checks, last run passing.
There are no frontend or end-to-end tests.

## What is real vs synthetic

| Item | Status |
| --- | --- |
| Ranking logic, tariff arithmetic, budget fill, subsidy cap | Real code, deterministic, unit-tested |
| Tamil Nadu domestic slabs | **Unverified** — unofficial secondary summary, conflicts with other tables |
| Grid emission factor (0.675 tCO₂/MWh) | **Unverified** — secondary source |
| PM Surya Ghar subsidy amounts, benchmark costs | Unverified since Feb 2024 |
| Solar yield (1,400 kWh/kW/yr), water value (₹30/kL) | **Placeholder** |
| Upgrade costs and savings per unit | **Placeholder estimates** |
| Usage model (OLS) | Trained on **synthetic** data; R²/MAE are not real-world accuracy |
| Demo households (Chennai 600 sq ft, Coimbatore 2,000 sq ft) | **Synthetic**, invented figures |
| Bill text extraction | Requires a real model key; images are sent whole and **cannot be redacted** |

Only Chennai and Coimbatore are supported.

## Demo script (5 minutes)

1. Open the app. Point out the honesty strip: unverified tariff, synthetic usage model, two cities.
2. Press **Try the demo** on “600 sq ft rented flat, Chennai”. Show the ranked list — rooftop solar is absent
   because the home is rented without roof access.
3. Tick two more items; watch the marigold budget bar fill and the savings, CO₂ and payback update.
4. Ask the assistant “What should I do first?”. Note that it quotes only plan numbers (and says so itself
   when no model key is configured).
5. Open **Impact**, set 10,000 homes, and read the basis and assumptions under the numbers.
6. Press **Print / save as PDF** on the plan, then open **Assumptions** to show each value's source and date.

## Pitch deck outline

1. **Problem** — Indian homeowners get generic advice; tariffs, subsidies and roof rights decide what is actually worth doing.
2. **Product** — a ranked, budget-aware plan with payback, carbon and water, in two minutes without a login.
3. **Why now** — rooftop solar subsidies, rising tariffs, water stress in Tamil Nadu cities.
4. **How it works** — open assumptions file, transparent scoring, grounded assistant, printable one-pager.
5. **What is honest** — unverified inputs labelled in the UI; synthetic model labelled; no fake precision.
6. **Distribution** — installers, RWAs, municipal programmes; white-label the assumptions file.
7. **Roadmap** — verified TNPDCL tariffs, city-wise irradiance and rainfall, real usage data, Tamil and Hindi UI.
8. **Ask** — pilot with one city programme and an installer network.

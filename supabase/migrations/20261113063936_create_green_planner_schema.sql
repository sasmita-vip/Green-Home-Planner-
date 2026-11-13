/*
# Create Green Home Planners schema

1. New Tables
- `households`: one row per household profile (city, home size, people, appliances, electricity and water use, budget, roof access, ownership). Stores an owner token hash, never the token itself.
- `bills`: extracted or manually entered bill values (billing period, units, tariff slab, amount). No names, addresses or consumer numbers.
- `plans`: a saved ranked plan for a household (items, totals, assumptions version).
- `predictions`: a usage prediction for a household, with an "unusually high" flag.
- `chat_messages`: assistant conversation history per household (en, ta, hi).

2. Security
- Row level security is enabled on every table with no policies, so the browser (anon and authenticated roles) cannot read or write any row directly.
- Only the `service_role` (used by the server function) is granted access. The server checks each household's owner token before acting.

3. Important notes
- Every child table cascades on delete from `households`, so one delete removes everything tied to a profile.
- Indexes on `household_id` for every child table.
- Demo households are flagged with `is_demo` so they can be seeded and reset.
*/

CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_hash text NOT NULL,
  city text NOT NULL,
  home_size_sqft integer NOT NULL CHECK (home_size_sqft BETWEEN 100 AND 20000),
  people integer NOT NULL CHECK (people BETWEEN 1 AND 30),
  appliances jsonb NOT NULL DEFAULT '{}'::jsonb,
  electricity_kwh_month integer NOT NULL CHECK (electricity_kwh_month BETWEEN 0 AND 10000),
  water_litres_day integer NOT NULL CHECK (water_litres_day BETWEEN 0 AND 50000),
  budget_inr integer NOT NULL CHECK (budget_inr BETWEEN 0 AND 10000000),
  roof_access boolean NOT NULL DEFAULT false,
  ownership text NOT NULL CHECK (ownership IN ('owned', 'rented')),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS households_owner_hash_idx ON households (owner_hash);

CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  billing_period text NOT NULL,
  units integer NOT NULL CHECK (units >= 0),
  tariff_slab text,
  amount_inr numeric(10, 2),
  source text NOT NULL CHECK (source IN ('extracted', 'manual')),
  extraction_confidence numeric(3, 2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bills_household_id_idx ON bills (household_id);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  items jsonb NOT NULL,
  totals jsonb NOT NULL,
  assumptions_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plans_household_id_idx ON plans (household_id);

CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  predicted_kwh numeric(10, 2) NOT NULL,
  actual_kwh integer,
  flagged_high boolean NOT NULL DEFAULT false,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS predictions_household_id_idx ON predictions (household_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  language text NOT NULL CHECK (language IN ('en', 'ta', 'hi')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_household_id_idx ON chat_messages (household_id);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON households, bills, plans, predictions, chat_messages TO service_role;

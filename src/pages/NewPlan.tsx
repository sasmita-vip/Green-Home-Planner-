import { useState, type FormEvent } from 'react';
import { ApiError, request } from '../lib/api';
import type { HouseholdInput, PlanResponse } from '../lib/types';
import { getOwnerToken, rememberHousehold } from '../lib/session';
import { navigate } from '../lib/router';
import { FieldError, Notice, SectionTitle } from '../components/ui';

type FormState = {
  city: string;
  ownership: 'owned' | 'rented';
  roof_access: boolean;
  home_size_sqft: string;
  people: string;
  ac: string;
  fan: string;
  geyser: string;
  pump: string;
  electricity_kwh_month: string;
  water_litres_day: string;
  budget_inr: string;
};

const initial: FormState = {
  city: '',
  ownership: 'rented',
  roof_access: false,
  home_size_sqft: '',
  people: '3',
  ac: '0',
  fan: '2',
  geyser: '0',
  pump: '0',
  electricity_kwh_month: '',
  water_litres_day: '',
  budget_inr: '25000',
};

type NumericField = 'home_size_sqft' | 'people' | 'ac' | 'fan' | 'geyser' | 'pump' | 'electricity_kwh_month' | 'water_litres_day' | 'budget_inr';

const limits: Record<NumericField, [number, number, string]> = {
  home_size_sqft: [100, 20000, 'Home size'],
  people: [1, 30, 'People'],
  ac: [0, 10, 'Air conditioners'],
  fan: [0, 30, 'Fans'],
  geyser: [0, 10, 'Geysers'],
  pump: [0, 10, 'Water pumps'],
  electricity_kwh_month: [0, 10000, 'Monthly electricity'],
  water_litres_day: [0, 50000, 'Daily water'],
  budget_inr: [0, 10000000, 'Budget'],
};

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.city) errors.city = 'Choose Chennai or Coimbatore. Other cities are not supported yet.';
  (Object.keys(limits) as NumericField[]).forEach((key) => {
    const [min, max, label] = limits[key];
    const raw = form[key];
    if (raw.trim() === '') {
      errors[key] = `${label} is needed.`;
      return;
    }
    const value = Number(raw);
    if (!Number.isInteger(value)) errors[key] = `${label} must be a whole number.`;
    else if (value < min || value > max) errors[key] = `${label} must be between ${min} and ${max}.`;
  });
  return errors;
}

function NumberField({
  id,
  label,
  hint,
  value,
  error,
  onChange,
  suffix,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  suffix?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-baseline gap-2">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
          className={`field ${error ? 'field-invalid' : ''}`}
        />
        {suffix ? <span className="text-xs text-pine-500 dark:text-mint-200/70">{suffix}</span> : null}
      </div>
      {hint && !error ? <p className="mt-1 text-xs text-pine-500 dark:text-mint-200/60">{hint}</p> : null}
      <span id={`${id}-error`}>
        <FieldError message={error} />
      </span>
    </div>
  );
}

export function NewPlan() {
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }

    const household: HouseholdInput = {
      city: form.city,
      ownership: form.ownership,
      roof_access: form.roof_access,
      home_size_sqft: Number(form.home_size_sqft),
      people: Number(form.people),
      appliances: {
        ac: Number(form.ac),
        fan: Number(form.fan),
        geyser: Number(form.geyser),
        pump: Number(form.pump),
      },
      electricity_kwh_month: Number(form.electricity_kwh_month),
      water_litres_day: Number(form.water_litres_day),
      budget_inr: Number(form.budget_inr),
    };

    setBusy(true);
    const token = getOwnerToken();
    try {
      const created = await request<{ id: string }>('/households', { method: 'POST', body: household, token });
      await request<PlanResponse>('/plan', { method: 'POST', body: { household_id: created.id }, token });
      rememberHousehold(created.id);
      navigate(`/plan/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.field) setErrors({ [err.field]: err.message });
        setSubmitError(err.message);
      } else {
        setSubmitError('Something went wrong while saving. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl py-6">
      <SectionTitle eyebrow="Step 1 of 1">Tell us about your home</SectionTitle>
      <p className="mb-6 max-w-xl text-sm leading-relaxed text-pine-600 dark:text-mint-200/80">
        Only <strong>Chennai</strong> and <strong>Coimbatore</strong> are supported. Estimates are approximate; use last
        month's bill if you have it. Nothing here is a quote.
      </p>

      {submitError ? (
        <Notice tone="error" className="mb-6" title="We could not build the plan">
          {submitError}
        </Notice>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-8">
        <fieldset className="border-t hairline pt-5">
          <legend className="label">Where you live</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="city">
                City
              </label>
              <select
                id="city"
                value={form.city}
                aria-invalid={Boolean(errors.city)}
                onChange={(e) => set('city')(e.target.value)}
                className={`field ${errors.city ? 'field-invalid' : ''}`}
              >
                <option value="">Choose a city</option>
                <option value="Chennai">Chennai</option>
                <option value="Coimbatore">Coimbatore</option>
              </select>
              <p className="mt-1 text-xs text-pine-500 dark:text-mint-200/60">No other city is supported yet.</p>
              <FieldError message={errors.city} />
            </div>
            <div>
              <span className="label">Do you own or rent?</span>
              <div className="mt-1.5 flex gap-2">
                {(['rented', 'owned'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={form.ownership === option}
                    onClick={() => setForm((prev) => ({ ...prev, ownership: option }))}
                    className={`btn flex-1 capitalize ${form.ownership === option ? 'border-accent bg-accent/10 text-accent-dark dark:text-accent-light' : ''}`}
                  >
                    {option === 'rented' ? 'I rent' : 'I own'}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.roof_access}
                  onChange={(e) => setForm((prev) => ({ ...prev, roof_access: e.target.checked }))}
                  className="h-4 w-4 accent-[#2f6b4f]"
                />
                I can access the roof
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset className="border-t hairline pt-5">
          <legend className="label">The home</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <NumberField
              id="home_size_sqft"
              label="Built-up area"
              suffix="sq ft"
              value={form.home_size_sqft}
              error={errors.home_size_sqft}
              onChange={set('home_size_sqft')}
            />
            <NumberField
              id="people"
              label="People living here"
              value={form.people}
              error={errors.people}
              onChange={set('people')}
            />
          </div>
        </fieldset>

        <fieldset className="border-t hairline pt-5">
          <legend className="label">Appliances</legend>
          <p className="mt-1 text-xs text-pine-500 dark:text-mint-200/60">Count working units. Zero is fine.</p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumberField id="ac" label="ACs" value={form.ac} error={errors.ac} onChange={set('ac')} />
            <NumberField id="fan" label="Fans" value={form.fan} error={errors.fan} onChange={set('fan')} />
            <NumberField id="geyser" label="Geysers" value={form.geyser} error={errors.geyser} onChange={set('geyser')} />
            <NumberField id="pump" label="Pumps" value={form.pump} error={errors.pump} onChange={set('pump')} />
          </div>
        </fieldset>

        <fieldset className="border-t hairline pt-5">
          <legend className="label">Use and budget</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <NumberField
              id="electricity_kwh_month"
              label="Electricity last month"
              suffix="kWh"
              hint="On your bill, the 'units consumed' line."
              value={form.electricity_kwh_month}
              error={errors.electricity_kwh_month}
              onChange={set('electricity_kwh_month')}
            />
            <NumberField
              id="water_litres_day"
              label="Water used per day"
              suffix="litres"
              hint="Rough is fine — a tanker count or a metre reading."
              value={form.water_litres_day}
              error={errors.water_litres_day}
              onChange={set('water_litres_day')}
            />
            <NumberField
              id="budget_inr"
              label="What you can spend this year"
              suffix="₹"
              value={form.budget_inr}
              error={errors.budget_inr}
              onChange={set('budget_inr')}
            />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-4 border-t hairline pt-5">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Building your plan…' : 'Build my plan'}
          </button>
          <p className="text-xs text-pine-500 dark:text-mint-200/60">
            No login. This browser keeps a random token that only it knows.
          </p>
        </div>
      </form>
    </div>
  );
}

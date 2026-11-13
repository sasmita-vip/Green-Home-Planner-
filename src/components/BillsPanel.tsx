import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, request } from '../lib/api';
import type { Bill, ExtractedBillResponse } from '../lib/types';
import { Notice } from './ui';

type Form = { billing_period: string; units: string; tariff_slab: string; amount_inr: string };
const empty: Form = { billing_period: '', units: '', tariff_slab: '', amount_inr: '' };

export function BillsPanel({ householdId, token }: { householdId: string; token: string }) {
  const [mode, setMode] = useState<'upload' | 'manual'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [source, setSource] = useState<'extracted' | 'manual'>('manual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billsError, setBillsError] = useState<string | null>(null);

  const loadBills = async () => {
    try {
      const res = await request<{ bills: Bill[] }>(`/bills?household_id=${householdId}`, { token });
      setBills(res.bills);
      setBillsError(null);
    } catch (err) {
      setBillsError(err instanceof ApiError ? err.message : 'Bills could not be loaded.');
    }
  };

  useEffect(() => {
    void loadBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const toBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(f);
    });

  const extract = async () => {
    if (!file) {
      setError('Choose a bill image or PDF first, or enter the values by hand.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Keep the file under 5 MB.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const base64 = await toBase64(file);
      const res = await request<ExtractedBillResponse>('/bills/extract', {
        method: 'POST',
        token,
        body: { household_id: householdId, image_base64: base64, mime_type: file.type || 'image/jpeg' },
      });
      setForm({
        billing_period: res.fields.billing_period ?? '',
        units: res.fields.units === null ? '' : String(res.fields.units),
        tariff_slab: res.fields.tariff_slab ?? '',
        amount_inr: res.fields.amount_inr === null ? '' : String(res.fields.amount_inr),
      });
      setSource('extracted');
      setSuccess('Check every field before saving. The model can read a digit wrong.');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'The bill could not be read.';
      setError(`${message} Enter the values by hand instead.`);
      setMode('manual');
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.billing_period)) {
      setError('Pick the billing month.');
      return;
    }
    if (!/^\d+$/.test(form.units)) {
      setError('Units must be a whole number.');
      return;
    }
    setBusy(true);
    try {
      await request<{ bill: Bill }>('/bills', {
        method: 'POST',
        token,
        body: {
          household_id: householdId,
          billing_period: form.billing_period,
          units: Number(form.units),
          tariff_slab: form.tariff_slab || null,
          amount_inr: form.amount_inr === '' ? null : Number(form.amount_inr),
          source,
        },
      });
      setSuccess('Bill saved against this plan.');
      setForm(empty);
      setFile(null);
      await loadBills();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The bill could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof Form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <section aria-labelledby="bills-title" className="border-t hairline pt-6">
      <h2 id="bills-title" className="text-xl">
        Add a bill
      </h2>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-pine-500 dark:text-mint-200/65">
        A bill image is sent whole to the model. We cannot redact your name, address or consumer number before it is
        sent — crop the image first if you would rather not share those. Reading a bill needs a configured model; if it
        is not set up, type the numbers instead.
      </p>

      <div className="mt-4 flex gap-1 border-b hairline" role="tablist" aria-label="Bill entry method">
        {(['upload', 'manual'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={mode === tab}
            onClick={() => setMode(tab)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              mode === tab ? 'border-accent text-accent-dark dark:text-accent-light' : 'border-transparent text-pine-500'
            }`}
          >
            {tab === 'upload' ? 'Upload a bill' : 'Enter by hand'}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="bill-file">
              Bill image or PDF
            </label>
            <input
              id="bill-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1.5 w-full text-sm text-pine-600 file:mr-3 file:border file:border-pine-800/25 file:bg-transparent file:px-3 file:py-2 file:text-sm dark:text-mint-200/80 dark:file:border-mint-200/25"
            />
            {file ? <p className="mt-1 text-xs text-pine-500 dark:text-mint-200/60">{file.name}</p> : null}
          </div>
          <button type="button" className="btn-primary" onClick={() => void extract()} disabled={busy}>
            {busy ? 'Reading…' : 'Read bill'}
          </button>
        </div>
      ) : null}

      <form onSubmit={save} noValidate className="mt-5 grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="billing_period">
            Billing month
          </label>
          <input
            id="billing_period"
            type="month"
            value={form.billing_period}
            onChange={(e) => set('billing_period', e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="units">
            Units
          </label>
          <input
            id="units"
            inputMode="numeric"
            value={form.units}
            onChange={(e) => set('units', e.target.value.replace(/[^\d]/g, ''))}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="tariff_slab">
            Slab (optional)
          </label>
          <input
            id="tariff_slab"
            value={form.tariff_slab}
            onChange={(e) => set('tariff_slab', e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="bill_amount">
            Amount ₹ (optional)
          </label>
          <input
            id="bill_amount"
            inputMode="numeric"
            value={form.amount_inr}
            onChange={(e) => set('amount_inr', e.target.value.replace(/[^\d.]/g, ''))}
            className="field"
          />
        </div>
        <div className="sm:col-span-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save bill'}
          </button>
          <span className="text-xs text-pine-500 dark:text-mint-200/60">
            Saving as {source === 'extracted' ? 'model-read, checked by you' : 'entered by hand'}.
          </span>
        </div>
      </form>

      {error ? (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      ) : null}
      {success ? (
        <Notice tone="info" className="mt-4">
          {success}
        </Notice>
      ) : null}

      <div className="mt-6">
        <h3 className="label">Saved bills</h3>
        {billsError ? (
          <p className="mt-2 text-sm text-clay">{billsError}</p>
        ) : bills.length === 0 ? (
          <p className="mt-2 text-sm text-pine-500 dark:text-mint-200/70">
            No bills yet. Adding two or three months makes the estimate less of a guess.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-pine-800/10 text-sm dark:divide-mint-200/15">
            {bills.map((bill) => (
              <li key={bill.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="font-medium">{bill.billing_period}</span>
                <span className="tabular-nums">{bill.units} units</span>
                <span className="tabular-nums text-pine-500 dark:text-mint-200/70">
                  {bill.amount_inr === null ? '—' : `₹${Number(bill.amount_inr).toFixed(0)}`}
                </span>
                <span className="text-xs uppercase tracking-[0.1em] text-pine-500 dark:text-mint-200/60">{bill.source}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

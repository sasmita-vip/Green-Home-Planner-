import assumptions from "./assumptions.json" with { type: "json" };

type Slab = { from_units: number; to_units: number | null; rate: number };

const slabs: Slab[] = assumptions.tariff.domestic_slabs_per_unit_inr;

export function rateForUnits(units: number): number {
  const slab = slabs.find((s) => units >= s.from_units && (s.to_units === null || units <= s.to_units));
  return (slab ?? slabs[slabs.length - 1]).rate;
}

export function monthlyBillInr(units: number): number {
  let remaining = Math.max(0, units);
  let total = 0;
  for (const slab of slabs) {
    if (remaining <= 0) break;
    const lowerExclusive = slab.from_units === 0 ? 0 : slab.from_units - 1;
    const upper = slab.to_units ?? Infinity;
    const span = Math.min(remaining, upper - lowerExclusive);
    total += span * slab.rate;
    remaining -= span;
  }
  return Math.round(total * 100) / 100;
}

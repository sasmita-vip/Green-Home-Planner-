const rupee = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function inr(value: number): string {
  return `₹${rupee.format(Math.round(value))}`;
}

export function num(value: number): string {
  return rupee.format(Math.round(value));
}

export function oneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return 'not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function monthName(month: number): string {
  return new Date(2026, month - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
}

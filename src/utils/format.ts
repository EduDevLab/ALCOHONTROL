const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(num) ? num : 0);
}

export function formatDateShort(isoOrDate: string | Date): string {
  const raw = typeof isoOrDate === 'string' ? isoOrDate : isoOrDate.toISOString();
  const datePart = raw.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return raw;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

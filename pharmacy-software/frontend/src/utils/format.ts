export function formatPKR(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatNumber(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatShortRef(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.length <= 8) return id.toUpperCase();
  return id.slice(0, 8).toUpperCase();
}

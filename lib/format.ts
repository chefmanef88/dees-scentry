export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 0
  }).format(amount).replace('GHS', 'GH₵');
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

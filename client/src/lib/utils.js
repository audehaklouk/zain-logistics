import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(date) {
  if (!date) return '—';
  try { return format(new Date(date), 'MMM d, yyyy'); } catch { return date; }
}

export function formatDateTime(date) {
  if (!date) return '—';
  try { return format(new Date(date), 'MMM d, yyyy HH:mm'); } catch { return date; }
}

export function timeAgo(date) {
  if (!date) return '';
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }); } catch { return ''; }
}

export function formatCurrency(amount, currency) {
  if (amount == null || amount === '') return '—';
  if (!currency) return String(amount);
  const symbols = { EUR: '€', USD: '$', GBP: '£' };
  const sym = symbols[currency] || currency;
  return `${sym}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Order statuses
export const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const STATUS_FLOW = ORDER_STATUSES.map(s => s.value);

export function statusLabel(value) {
  return ORDER_STATUSES.find(s => s.value === value)?.label || value;
}

export function statusBadgeClass(status) {
  const map = {
    pending: 'badge-draft',
    confirmed: 'badge-confirmed',
    shipped: 'badge-shipped',
    in_transit: 'badge-transit',
    delivered: 'badge-delivered',
    cancelled: 'badge-cancelled',
  };
  return `badge ${map[status] || 'badge-draft'}`;
}

export function statusColor(status) {
  const map = {
    pending: '#6B7280',
    confirmed: '#D97706',
    shipped: '#EA580C',
    in_transit: '#0369A1',
    delivered: '#059669',
    cancelled: '#DC2626',
  };
  return map[status] || '#6B7280';
}

// Currencies — EUR, USD, GBP only (per ARCHITECTURE.md)
export const CURRENCIES = ['EUR', 'USD', 'GBP'];

// Destinations
export const DESTINATIONS = [
  { value: 'aqaba', label: 'Aqaba' },
  { value: 'ksa', label: 'KSA' },
  { value: 'um_qaser', label: 'Um Qaser' },
  { value: 'mersin', label: 'Mersin' },
  { value: 'lattakia', label: 'Lattakia' },
  { value: 'lebanon', label: 'Lebanon' },
  { value: 'other', label: 'Other' },
];

export function destinationLabel(value, custom) {
  if (value === 'other') return custom || 'Other';
  return DESTINATIONS.find(d => d.value === value)?.label || value;
}

// Categories
export const CATEGORIES = [
  { value: 'brands', label: 'Brands' },
  { value: 'nuts', label: 'Nuts' },
  { value: 'all_tasty', label: 'All Tasty' },
  { value: 'other', label: 'Other' },
];

export function categoryLabel(value) {
  return CATEGORIES.find(c => c.value === value)?.label || value;
}

// Shipping lines
export const SHIPPING_LINES = [
  { value: 'maersk', label: 'Maersk' },
  { value: 'hapag_lloyd', label: 'Hapag-Lloyd' },
  { value: 'cma_cgm', label: 'CMA CGM' },
  { value: 'msc', label: 'MSC' },
  { value: 'other', label: 'Other' },
];

export function shippingLineLabel(value, custom) {
  if (value === 'other') return custom || 'Other';
  return SHIPPING_LINES.find(s => s.value === value)?.label || value;
}

// Containers helpers — new format: [{type:"40ft",number:""}, ...]
export function parseContainers(raw) {
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || []); }
  catch { return []; }
}

export function formatContainers(containersRaw) {
  const arr = parseContainers(containersRaw);
  if (!arr.length) return '—';
  const groups = {};
  for (const c of arr) groups[c.type] = (groups[c.type] || 0) + 1;
  return Object.entries(groups).map(([type, count]) => `${count} × ${type}`).join(', ');
}

export function countMissingContainerNumbers(containersRaw) {
  const arr = parseContainers(containersRaw);
  return arr.filter(c => !c.number || c.number.trim() === '').length;
}

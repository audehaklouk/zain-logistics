import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(date) {
  if (!date) return '—';
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date) {
  if (!date) return '—';
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

export function timeAgo(date) {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatCurrency(amount, currency = 'USD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function statusBadgeClass(status) {
  const map = {
    'Draft': 'badge-draft',
    'Sent': 'badge-sent',
    'Confirmed': 'badge-confirmed',
    'Shipped': 'badge-shipped',
    'In Transit': 'badge-transit',
    'Delivered': 'badge-delivered',
    'Delayed': 'badge-delayed',
  };
  return `badge ${map[status] || 'badge-draft'}`;
}

export function statusColor(status) {
  const map = {
    'Draft': '#6B7280',
    'Sent': '#2563EB',
    'Confirmed': '#D97706',
    'Shipped': '#EA580C',
    'In Transit': '#0369A1',
    'Delivered': '#059669',
  };
  return map[status] || '#6B7280';
}

export const STATUS_FLOW = ['Draft', 'Sent', 'Confirmed', 'Shipped', 'In Transit', 'Delivered'];

export const SHIPPING_LINES = ['Maersk', 'Hapag-Lloyd', 'MSC', 'CMA CGM', 'Evergreen', 'COSCO', 'Other'];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JOD', 'AED', 'TRY', 'INR', 'THB'];

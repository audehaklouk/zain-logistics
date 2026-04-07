import { statusBadgeClass, statusLabel } from '../lib/utils';

export default function StatusBadge({ status }) {
  return <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>;
}

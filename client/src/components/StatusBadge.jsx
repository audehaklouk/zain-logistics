import { statusBadgeClass } from '../lib/utils';

export default function StatusBadge({ status }) {
  return <span className={statusBadgeClass(status)}>{status}</span>;
}

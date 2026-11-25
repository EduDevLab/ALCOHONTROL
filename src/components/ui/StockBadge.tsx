import { WarningCircle } from '@phosphor-icons/react';

interface StockBadgeProps {
  existencias: number;
  suffix?: string;
  showWarningIcon?: boolean;
}

export function StockBadge({ existencias, suffix = ' uds', showWarningIcon = false }: StockBadgeProps) {
  const variant = existencias <= 0 ? 'badge-danger' : existencias <= 30 ? 'badge-warn' : 'badge-ok';

  return (
    <span className={`badge num-tabular ${variant}`}>
      {showWarningIcon && existencias <= 0 && <WarningCircle size={12} />}
      {existencias}
      {suffix}
    </span>
  );
}

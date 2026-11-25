import { ArrowsClockwise } from '@phosphor-icons/react';

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorCard({ title = 'Error al cargar', message, onRetry }: ErrorCardProps) {
  return (
    <div
      className="surface-card"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}
    >
      <span className="badge badge-danger">{title}</span>
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          <ArrowsClockwise size={15} />
          Reintentar
        </button>
      )}
    </div>
  );
}

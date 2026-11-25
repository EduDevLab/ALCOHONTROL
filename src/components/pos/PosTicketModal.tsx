import { Modal } from '../ui/Modal.tsx';
import { formatCurrency } from '../../utils/format.ts';

export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Ambos';

export interface PosCartItem {
  IdProducto: number;
  Nombre: string;
  Precio: number;
  ExistenciasMax: number;
  Cantidad: number;
}

interface PosTicketModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  cajeroNombre: string;
  fechaHoy: string;
  metodoPago: MetodoPago;
  efectivoMixto: number;
  tarjetaMixta: number;
  items: PosCartItem[];
  totalPiezas: number;
  totalTicket: number;
}

export function PosTicketModal({
  open,
  onClose,
  onConfirm,
  submitting,
  cajeroNombre,
  fechaHoy,
  metodoPago,
  efectivoMixto,
  tarjetaMixta,
  items,
  totalPiezas,
  totalTicket,
}: PosTicketModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resumen de Ticket"
      eyebrow="Alcohontrol · Expendio Pacífico"
      subtitle={`Tamazula, Guasave · ${fechaHoy}`}
      width={420}
      disableClose={submitting}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: 'var(--text-secondary)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span>Cajero: {cajeroNombre}</span>
        <span className="badge badge-neutral">
          {metodoPago === 'Ambos'
            ? `Efectivo ${formatCurrency(efectivoMixto)} + Tarjeta ${formatCurrency(tarjetaMixta)}`
            : `Pago: ${metodoPago}`}
        </span>
      </div>

      <div
        style={{
          borderTop: '1px dashed var(--border-subtle)',
          borderBottom: '1px dashed var(--border-subtle)',
          padding: '12px 0',
          maxHeight: 240,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {items.map((item) => (
          <div
            key={item.IdProducto}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, fontSize: 13 }}
          >
            <div style={{ minWidth: 0 }}>
              <span className="num-tabular" style={{ color: 'var(--accent-gold)', fontWeight: 600, marginRight: 6 }}>
                {item.Cantidad}x
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.Nombre}</span>
              <span className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                ({formatCurrency(item.Precio)})
              </span>
            </div>
            <span className="num-tabular" style={{ fontWeight: 600, flexShrink: 0 }}>
              {formatCurrency(item.Cantidad * item.Precio)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{totalPiezas} artículos</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Total del ticket</div>
        </div>
        <div className="hero-metric" style={{ fontSize: 28, fontWeight: 600, color: 'var(--accent-gold)' }}>
          {formatCurrency(totalTicket)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
        <button type="button" className="btn" disabled={submitting} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn btn-gold" disabled={submitting} onClick={onConfirm}>
          {submitting ? 'Registrando…' : 'Confirmar Ticket'}
        </button>
      </div>
    </Modal>
  );
}

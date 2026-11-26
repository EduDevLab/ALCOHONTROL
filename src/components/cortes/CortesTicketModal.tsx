import { Printer } from '@phosphor-icons/react';
import { Modal } from '../ui/Modal.tsx';
import type { DetalleVentaItem, VentaResumen } from '../../types/alcohontrol.ts';
import { formatCurrency, formatDateShort } from '../../utils/format.ts';

interface CortesTicketModalProps {
  venta: VentaResumen | null;
  items: DetalleVentaItem[];
  loading: boolean;
  onClose: () => void;
}

export function CortesTicketModal({ venta, items, loading, onClose }: CortesTicketModalProps) {
  return (
    <Modal
      open={Boolean(venta)}
      onClose={onClose}
      eyebrow="Alcohontrol · Expendio Pacífico"
      title={venta ? `Ticket de Venta #${venta.IdVenta}` : 'Ticket de Venta'}
      subtitle={venta ? `Tamazula, Guasave · ${formatDateShort(venta.FechaVenta)}` : undefined}
      width={440}
    >
      {venta && (
        <>
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
            <span>Cajero: {venta.Empleado}</span>
            <span className="badge badge-neutral num-tabular">
              {venta.TotalArticulosVendidos} {venta.TotalArticulosVendidos === 1 ? 'artículo' : 'artículos'}
            </span>
          </div>

          <div
            className="scroll-area"
            style={{
              borderTop: '1px dashed var(--border-subtle)',
              borderBottom: '1px dashed var(--border-subtle)',
              padding: '12px 0',
              maxHeight: 260,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {loading ? (
              [0, 1, 2].map((idx) => <div key={idx} className="skeleton" style={{ width: '100%', height: 28 }} />)
            ) : items.length === 0 ? (
              <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                Sin partidas registradas para este folio.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.IdDetalle}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 12,
                    fontSize: 13,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span
                      className="num-tabular"
                      style={{ color: 'var(--accent-gold)', fontWeight: 600, marginRight: 6 }}
                    >
                      {item.Cantidad}x
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.Producto}</span>
                    <span className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                      ({formatCurrency(item.PrecioUnitario)})
                    </span>
                  </div>
                  <span className="num-tabular" style={{ fontWeight: 600, flexShrink: 0 }}>
                    {formatCurrency(item.Subtotal)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Folio #{venta.IdVenta}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Total del ticket</div>
            </div>
            <div className="hero-metric" style={{ fontSize: 28, fontWeight: 600, color: 'var(--accent-gold)' }}>
              {formatCurrency(venta.TotalVenta)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" className="btn btn-pill" onClick={onClose}>
              Cerrar
            </button>
            <button type="button" className="btn btn-pill btn-gold" onClick={() => window.print()}>
              <Printer size={14} weight="bold" />
              Imprimir
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

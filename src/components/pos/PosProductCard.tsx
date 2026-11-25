import { CategoryIcon } from '../CategoryIcon.tsx';
import { StockBadge } from '../ui/StockBadge.tsx';
import type { ReporteProducto } from '../../types/alcohontrol.ts';
import { formatCurrency } from '../../utils/format.ts';

interface PosProductCardProps {
  producto: ReporteProducto;
  enCarrito: number;
  onAdd: (prod: ReporteProducto, qty: number) => void;
  onSubtractOne: (idProducto: number) => void;
}

const PACK_SIZES = [6, 12, 24] as const;

export function PosProductCard({ producto, enCarrito, onAdd, onSubtractOne }: PosProductCardProps) {
  const agotado = producto.Existencias <= 0;
  const lleno = enCarrito >= producto.Existencias;
  const esCerveza = /cerveza/i.test(producto.Categoria);

  return (
    <div
      role="button"
      tabIndex={agotado ? -1 : 0}
      aria-disabled={agotado || lleno}
      className={`pos-product-card ${agotado ? 'is-disabled' : ''} ${enCarrito > 0 ? 'in-cart' : ''}`}
      onClick={() => {
        if (!agotado && !lleno) onAdd(producto, 1);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (enCarrito > 0) {
          onSubtractOne(producto.IdProducto);
        }
      }}
      onKeyDown={(e) => {
        if (!agotado && !lleno && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onAdd(producto, 1);
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ color: 'var(--accent-gold)', display: 'inline-flex' }}>
            <CategoryIcon categoria={producto.Categoria} size={15} />
          </span>
          {producto.Categoria}
        </span>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {enCarrito > 0 && (
            <span
              className="badge num-tabular"
              style={{
                background: 'var(--accent-gold)',
                color: 'var(--accent-gold-text)',
                fontWeight: 700,
                padding: '2px 7px',
              }}
            >
              x{enCarrito}
            </span>
          )}
          <StockBadge existencias={producto.Existencias} suffix="" />
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {producto.Producto}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {producto.Proveedor}
        </div>
      </div>

      <div
        style={{
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span className="hero-metric" style={{ fontSize: 17, fontWeight: 600 }}>
          {formatCurrency(producto.Precio)}
        </span>

        {esCerveza && !agotado && (
          <div className="pos-pack-actions">
            {PACK_SIZES.map((pack) => (
              <button
                key={pack}
                type="button"
                className="pos-pack-btn num-tabular"
                disabled={producto.Existencias - enCarrito < pack}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(producto, pack);
                }}
                title={`Agregar ${pack} unidades`}
              >
                +{pack}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

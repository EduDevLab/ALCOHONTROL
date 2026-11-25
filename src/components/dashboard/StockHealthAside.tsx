import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from '@phosphor-icons/react';
import { CategoryIcon } from '../CategoryIcon.tsx';
import type { ProductoStockBajo, ReporteProducto } from '../../types/alcohontrol.ts';
import { formatCurrency } from '../../utils/format.ts';

interface StockHealthAsideProps {
  productos: ReporteProducto[];
  stockBajo: ProductoStockBajo[];
  totalAlertas: number;
  loading: boolean;
  onNavigateInventario: () => void;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function StockHealthAside({
  productos,
  stockBajo,
  totalAlertas,
  loading,
  onNavigateInventario,
}: StockHealthAsideProps) {
  const saludPct = useMemo(() => {
    if (productos.length === 0) return 100;
    const optimos = productos.filter((p) => Number(p.Existencias) > 30).length;
    return Number(((optimos / productos.length) * 100).toFixed(1));
  }, [productos]);

  const gaugeDashOffset = 100 - Math.min(100, Math.max(0, saludPct));

  return (
    <motion.aside
      className="surface-card"
      style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: EASE_OUT }}
    >
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Salud de Stock</h2>
          <button
            type="button"
            className="btn-circle"
            style={{ width: 32, height: 32 }}
            onClick={onNavigateInventario}
            title="Ir a Inventario"
          >
            <ArrowRight size={15} />
          </button>
        </div>

        {loading ? (
          <div className="skeleton" style={{ width: '100%', height: 185 }} />
        ) : (
          <div
            style={{
              background:
                'radial-gradient(circle at 50% 72%, rgba(229, 169, 59, 0.12) 0%, rgba(23, 26, 34, 0.4) 55%, rgba(8, 9, 12, 0.65) 100%)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: '18px 16px 14px',
              textAlign: 'center',
            }}
          >
            <div className="hero-metric" style={{ fontSize: 30, fontWeight: 600 }}>
              {saludPct.toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Productos con stock &gt; 30 uds
            </div>

            <svg
              viewBox="0 0 220 130"
              style={{ width: '100%', maxWidth: 215, display: 'block', margin: '0 auto', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="gaugeGoldGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#e5a93b" />
                  <stop offset="100%" stopColor="#f0b94e" />
                </linearGradient>
              </defs>

              <path
                d="M 18 112 A 92 92 0 0 1 202 112"
                fill="none"
                stroke="var(--bg-elevated)"
                strokeWidth="20"
                strokeLinecap="round"
                pathLength={100}
              />

              <path
                d="M 18 112 A 92 92 0 0 1 202 112"
                fill="none"
                stroke="url(#gaugeGoldGrad)"
                strokeWidth="20"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={gaugeDashOffset}
                className="gauge-arc-sweep"
                style={{ filter: 'drop-shadow(0 0 8px rgba(229, 169, 59, 0.28))' }}
              />
            </svg>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 500 }}>Alertas de Stock</span>
          <span className="badge badge-warn num-tabular">{loading ? '—' : totalAlertas}</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="skeleton" style={{ width: '100%', height: 44 }} />
            ))}
          </div>
        ) : stockBajo.length === 0 ? (
          <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Sin productos por debajo del mínimo.
          </div>
        ) : (
          <div className="scroll-area" style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, paddingRight: 4 }}>
            {stockBajo.map((item, idx) => {
              const agotado = item.Existencias === 0;
              return (
                <div
                  key={item.IdProducto}
                  className="stagger-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    animationDelay: `${140 + idx * 45}ms`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: agotado ? 'var(--status-danger)' : 'var(--status-warn)',
                        flexShrink: 0,
                      }}
                    >
                      <CategoryIcon categoria={item.Categoria} size={19} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.Producto}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.Categoria}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      className="num-tabular"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: agotado ? 'var(--status-danger)' : 'var(--status-warn)',
                      }}
                    >
                      {item.Existencias} uds
                    </div>
                    <div className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatCurrency(item.Precio)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.aside>
  );
}

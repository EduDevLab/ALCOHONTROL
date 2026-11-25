import { useMemo } from 'react';
import { motion } from 'motion/react';
import { TrendUp } from '@phosphor-icons/react';
import { CategoryIcon } from '../CategoryIcon.tsx';
import type { ReporteProducto } from '../../types/alcohontrol.ts';
import { formatCurrency } from '../../utils/format.ts';

interface InventoryValueCardProps {
  productos: ReporteProducto[];
  stockBajoCount: number;
  loading: boolean;
}

const CATEGORY_COLORS = ['#e5a93b', '#38bdf8', '#a855f7', '#22c55e'];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function InventoryValueCard({ productos, stockBajoCount, loading }: InventoryValueCardProps) {
  const valorTotalInventario = useMemo(
    () => productos.reduce((acc, p) => acc + Number(p.ValorTotalInventario || 0), 0),
    [productos],
  );

  const distribucionCategorias = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of productos) {
      const val = Number(p.ValorTotalInventario || 0);
      totals.set(p.Categoria, (totals.get(p.Categoria) ?? 0) + val);
    }
    const baseTotal = valorTotalInventario > 0 ? valorTotalInventario : 1;
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, valor], idx) => ({
        nombre,
        valor,
        pct: Math.round((valor / baseTotal) * 100),
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }));
  }, [productos, valorTotalInventario]);

  return (
    <motion.section
      className="surface-card"
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14, minHeight: 0 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.14, ease: EASE_OUT }}
    >
      {loading ? (
        <>
          <div>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Valor de Inventario</h2>
            <div className="skeleton" style={{ width: '65%', height: 34 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton" style={{ width: '100%', height: 10, borderRadius: 999 }} />
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="skeleton" style={{ width: '100%', height: 18 }} />
            ))}
          </div>
          <div className="skeleton" style={{ width: '55%', height: 18 }} />
        </>
      ) : (
        <>
          <div>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Valor de Inventario</h2>
            <div className="hero-metric" style={{ fontSize: 30, fontWeight: 600 }}>
              {formatCurrency(valorTotalInventario)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: 'var(--bg-elevated)',
                overflow: 'hidden',
                display: 'flex',
                gap: 3,
                padding: 2,
              }}
              aria-label="Distribución de inventario por categoría"
            >
              {distribucionCategorias.map((cat, idx) => (
                <div
                  key={cat.nombre}
                  className="bar-segment-enter"
                  style={{
                    width: `${Math.max(4, cat.pct)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: cat.color,
                    animationDelay: `${160 + idx * 70}ms`,
                  }}
                  title={`${cat.nombre}: ${formatCurrency(cat.valor)} (${cat.pct}%)`}
                />
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {distribucionCategorias.map((cat) => (
                <div
                  key={cat.nombre}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: cat.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: cat.color, display: 'inline-flex', alignItems: 'center' }}>
                      <CategoryIcon categoria={cat.nombre} size={14} />
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{cat.nombre}</span>
                  </div>

                  <div className="num-tabular" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{cat.pct}%</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatCurrency(cat.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              paddingTop: 6,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '999px',
                background: 'var(--accent-gold-soft)',
                color: 'var(--accent-gold)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendUp size={13} weight="bold" />
            </span>
            <span className="num-tabular" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {productos.length} productos
            </span>
            <span style={{ color: 'var(--text-muted)' }}>· {stockBajoCount} en alerta</span>
          </div>
        </>
      )}
    </motion.section>
  );
}

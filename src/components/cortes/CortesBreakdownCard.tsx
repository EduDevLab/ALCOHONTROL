import { useState } from 'react';
import { Tag, Users } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { CategoryIcon } from '../CategoryIcon.tsx';
import { esAdministrador, type VentaPorCategoria, type VentaPorEmpleado } from '../../types/alcohontrol.ts';
import { formatCurrency } from '../../utils/format.ts';

interface CortesBreakdownCardProps {
  porEmpleado: VentaPorEmpleado[];
  porCategoria: VentaPorCategoria[];
  ingresoTotal: number;
}

type BreakdownTab = 'empleado' | 'categoria';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function getInitials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function CortesBreakdownCard({ porEmpleado, porCategoria, ingresoTotal }: CortesBreakdownCardProps) {
  const [vista, setVista] = useState<BreakdownTab>('empleado');

  const safeTotal = ingresoTotal > 0 ? ingresoTotal : 1;

  return (
    <motion.section
      className="surface-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: 0.08, ease: EASE_OUT }}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 14,
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Desglose</h2>

        <div className="segmented-control" role="tablist" aria-label="Tipo de desglose">
          {(
            [
              { id: 'empleado', label: 'Empleados', icon: Users },
              { id: 'categoria', label: 'Categorías', icon: Tag },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const selected = vista === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`segmented-btn ${selected ? 'is-active' : ''}`}
                style={{ height: 28, padding: '0 11px' }}
                onClick={() => setVista(id)}
              >
                {selected && (
                  <motion.span
                    layoutId="cortes-breakdown-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="segmented-pill"
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
                  <Icon size={13} weight={selected ? 'bold' : 'regular'} />
                </span>
                <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          {vista === 'empleado' ? (
            <motion.div
              key="empleado"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {porEmpleado.length === 0 ? (
                <div style={{ padding: '28px 0', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                  Sin actividad de empleados en este periodo.
                </div>
              ) : (
                porEmpleado.map((emp) => {
                  const pct = Math.min(100, Math.round((Number(emp.MontoTotalVendido) / safeTotal) * 100));
                  const isAdmin = esAdministrador(emp.Puesto);
                  return (
                    <div
                      key={emp.IdEmpleado}
                      style={{
                        padding: '11px 13px',
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 10,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--accent-gold)',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(emp.Empleado)}
                          </span>
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
                              {emp.Empleado}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span className={`badge ${isAdmin ? 'badge-gold' : 'badge-neutral'}`}>
                                {emp.Puesto}
                              </span>
                              <span className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {emp.TotalVentas} {emp.TotalVentas === 1 ? 'venta' : 'ventas'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div className="num-tabular" style={{ fontSize: 14, fontWeight: 600 }}>
                            {formatCurrency(emp.MontoTotalVendido)}
                          </div>
                          <div className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {pct}%
                          </div>
                        </div>
                      </div>

                      <div className="cortes-share-track">
                        <div className="cortes-share-fill bar-segment-enter" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          ) : (
            <motion.div
              key="categoria"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {porCategoria.length === 0 ? (
                <div style={{ padding: '28px 0', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                  Sin ventas por categoría en este periodo.
                </div>
              ) : (
                porCategoria.map((cat) => {
                  const pct = Math.min(100, Math.round((Number(cat.MontoTotalVendido) / safeTotal) * 100));
                  return (
                    <div
                      key={cat.IdCategorias}
                      style={{
                        padding: '11px 13px',
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 10,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--accent-gold)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <CategoryIcon categoria={cat.Categoria} size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{cat.Categoria}</div>
                            <div className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {cat.TotalArticulosVendidos}{' '}
                              {cat.TotalArticulosVendidos === 1 ? 'artículo vendido' : 'artículos vendidos'}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div className="num-tabular" style={{ fontSize: 14, fontWeight: 600 }}>
                            {formatCurrency(cat.MontoTotalVendido)}
                          </div>
                          <div className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {pct}%
                          </div>
                        </div>
                      </div>

                      <div className="cortes-share-track">
                        <div className="cortes-share-fill bar-segment-enter" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

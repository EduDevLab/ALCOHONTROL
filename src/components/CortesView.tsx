import { useEffect, useMemo, useState } from 'react';
import {
  CalendarBlank,
  CheckCircle,
  DownloadSimple,
  Eye,
  Printer,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { CortesBreakdownCard } from './cortes/CortesBreakdownCard.tsx';
import { CortesTicketModal } from './cortes/CortesTicketModal.tsx';
import { ErrorCard } from './ui/ErrorCard.tsx';
import { api } from '../services/api.ts';
import type { CorteVentas, DetalleVentaItem, TipoCorte, VentaResumen } from '../types/alcohontrol.ts';
import { formatCurrency, formatDateShort, getTodayIso } from '../utils/format.ts';

interface CortesViewProps {
  searchQuery: string;
}

interface FeedbackNotice {
  type: 'success' | 'error';
  text: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const TIPOS_CORTE: Array<{ id: TipoCorte; label: string }> = [
  { id: 'diario', label: 'Diario' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensual', label: 'Mensual' },
];

export function CortesView({ searchQuery }: CortesViewProps) {
  const [todayIso] = useState(() => getTodayIso());
  const [tipo, setTipo] = useState<TipoCorte>('diario');
  const [fecha, setFecha] = useState<string>(() => todayIso);
  const [reloadTick, setReloadTick] = useState(0);
  const [corte, setCorte] = useState<CorteVentas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackNotice | null>(null);

  const [selectedVenta, setSelectedVenta] = useState<VentaResumen | null>(null);
  const [detalleItems, setDetalleItems] = useState<DetalleVentaItem[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.reportes
      .corte({ tipo, fecha })
      .then((data) => {
        if (!cancelled) {
          setCorte(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al generar el corte.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tipo, fecha, reloadTick]);

  useEffect(() => {
    if (!feedback || feedback.type !== 'success') return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const ventasFiltradas = useMemo(() => {
    if (!corte) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return corte.ventas;
    return corte.ventas.filter(
      (v) =>
        String(v.IdVenta).includes(q) ||
        v.Empleado.toLowerCase().includes(q) ||
        formatDateShort(v.FechaVenta).toLowerCase().includes(q),
    );
  }, [corte, searchQuery]);

  const abrirDetalle = async (venta: VentaResumen) => {
    setSelectedVenta(venta);
    setDetalleItems([]);
    setDetalleLoading(true);
    try {
      const items = await api.ventas.detalle(venta.IdVenta);
      setDetalleItems(items);
    } catch (err) {
      setSelectedVenta(null);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo cargar el detalle de la venta.',
      });
    } finally {
      setDetalleLoading(false);
    }
  };

  const exportarCsv = () => {
    if (!corte) return;
    const rows = [
      ['Folio', 'Fecha', 'Empleado', 'Articulos', 'Total'],
      ...ventasFiltradas.map((v) => [
        String(v.IdVenta),
        String(v.FechaVenta).slice(0, 10),
        `"${v.Empleado.replace(/"/g, '""')}"`,
        String(v.TotalArticulosVendidos),
        String(v.TotalVenta),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corte-${corte.tipo}-${corte.desde}-a-${corte.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({
      type: 'success',
      text: `CSV exportado (${ventasFiltradas.length} registros).`,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Cortes y Reportes</h1>

        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="segmented-control" role="tablist" aria-label="Tipo de corte">
            {TIPOS_CORTE.map(({ id, label }) => {
              const selected = tipo === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`segmented-btn ${selected ? 'is-active' : ''}`}
                  onClick={() => setTipo(id)}
                >
                  {selected && (
                    <motion.span
                      layoutId="cortes-tipo-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="segmented-pill"
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
                </button>
              );
            })}
          </div>

          <label className="cortes-date-pill" title="Fecha base del corte">
            <CalendarBlank size={14} />
            <input
              type="date"
              aria-label="Fecha base del corte"
              value={fecha}
              onChange={(e) => {
                if (e.target.value) setFecha(e.target.value);
              }}
            />
          </label>

          {fecha !== todayIso && (
            <button
              type="button"
              className="btn btn-pill"
              style={{ height: 36, fontSize: 12 }}
              onClick={() => setFecha(todayIso)}
            >
              Hoy
            </button>
          )}

          <button
            type="button"
            className="btn btn-pill"
            style={{ height: 36 }}
            onClick={exportarCsv}
            disabled={!corte}
          >
            <DownloadSimple size={14} />
            CSV
          </button>

          <button
            type="button"
            className="btn btn-pill btn-gold"
            style={{ height: 36 }}
            onClick={() => window.print()}
            disabled={!corte}
          >
            <Printer size={14} weight="bold" />
            Imprimir
          </button>
        </div>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.text}
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className={`inv-feedback-banner ${feedback.type === 'success' ? 'is-success' : 'is-error'}`}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {feedback.type === 'success' ? (
                <CheckCircle size={16} weight="fill" />
              ) : (
                <WarningCircle size={16} weight="fill" />
              )}
              {feedback.text}
            </span>
            <button
              type="button"
              className="btn-ghost"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                padding: 4,
              }}
              onClick={() => setFeedback(null)}
              aria-label="Cerrar aviso"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0 }}>
          <section className="surface-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="skeleton" style={{ width: '100%', height: 54 }} />
            ))}
          </section>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 58%) minmax(0, 42%)', gap: 20, flex: 1, minHeight: 0 }}>
            <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2, 3, 4].map((idx) => (
                <div key={idx} className="skeleton" style={{ width: '100%', height: 38 }} />
              ))}
            </section>
            <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="skeleton" style={{ width: '100%', height: 58 }} />
              ))}
            </section>
          </div>
        </div>
      ) : error ? (
        <ErrorCard title="Error" message={error} onRetry={() => setReloadTick((t) => t + 1)} />
      ) : (
        corte && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0 }}>
            <motion.section
              className="surface-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 16,
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ingreso Total</div>
                <div className="hero-metric" style={{ fontSize: 28, fontWeight: 600, color: 'var(--accent-gold)' }}>
                  {formatCurrency(corte.resumen.ingresoTotal)}
                </div>
                <div className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {formatDateShort(corte.desde)} — {formatDateShort(corte.hasta)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ventas Totales</div>
                <div className="num-tabular" style={{ fontSize: 28, fontWeight: 600 }}>
                  {corte.resumen.totalVentas}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
                  Corte {corte.tipo}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Artículos Vendidos</div>
                <div className="num-tabular" style={{ fontSize: 28, fontWeight: 600 }}>
                  {corte.resumen.totalArticulos}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Unidades despachadas</div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ticket Promedio</div>
                <div className="num-tabular" style={{ fontSize: 28, fontWeight: 600 }}>
                  {formatCurrency(corte.resumen.ticketPromedio)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Por operación</div>
              </div>
            </motion.section>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 58%) minmax(0, 42%)',
                gap: 20,
                flex: 1,
                minHeight: 0,
              }}
            >
              <motion.section
                className="surface-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.04, ease: EASE_OUT }}
                style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 12,
                    flexShrink: 0,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Historial de Ventas</h2>
                  <span className="badge badge-neutral num-tabular">
                    {ventasFiltradas.length} {ventasFiltradas.length === 1 ? 'folio' : 'folios'}
                  </span>
                </div>

                {ventasFiltradas.length === 0 ? (
                  <div style={{ padding: '32px 0', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                    {searchQuery.trim()
                      ? 'Ningún folio coincide con la búsqueda.'
                      : 'No hubo ventas registradas en este periodo.'}
                  </div>
                ) : (
                  <div className="scroll-area" style={{ flex: 1 }}>
                    <table className="clean-table">
                      <thead>
                        <tr>
                          <th>Folio</th>
                          <th>Empleado</th>
                          <th>Piezas</th>
                          <th>Total</th>
                          <th>Fecha</th>
                          <th style={{ textAlign: 'right', width: 96 }}>Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventasFiltradas.map((v) => (
                          <tr
                            key={v.IdVenta}
                            className="inv-row"
                            style={{ cursor: 'pointer' }}
                            onClick={() => void abrirDetalle(v)}
                          >
                            <td className="num-tabular" style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
                              #{v.IdVenta}
                            </td>
                            <td style={{ fontWeight: 500 }}>{v.Empleado}</td>
                            <td className="num-tabular">{v.TotalArticulosVendidos}</td>
                            <td className="num-tabular" style={{ fontWeight: 600 }}>
                              {formatCurrency(v.TotalVenta)}
                            </td>
                            <td className="num-tabular" style={{ color: 'var(--text-muted)' }}>
                              {formatDateShort(v.FechaVenta)}
                            </td>
                            <td style={{ textAlign: 'right', width: 96 }}>
                              <div className="inv-row-actions">
                                <button
                                  type="button"
                                  className="btn"
                                  style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void abrirDetalle(v);
                                  }}
                                  title="Ver ticket"
                                  aria-label={`Ver ticket #${v.IdVenta}`}
                                >
                                  <Eye size={13} />
                                  Ver
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.section>

              <CortesBreakdownCard
                porEmpleado={corte.porEmpleado}
                porCategoria={corte.porCategoria}
                ingresoTotal={corte.resumen.ingresoTotal}
              />
            </div>
          </div>
        )
      )}

      <CortesTicketModal
        venta={selectedVenta}
        items={detalleItems}
        loading={detalleLoading}
        onClose={() => setSelectedVenta(null)}
      />
    </div>
  );
}

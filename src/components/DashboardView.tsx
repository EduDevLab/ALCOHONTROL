import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ArrowsClockwise, TrendUp } from '@phosphor-icons/react';
import { CategoryIcon } from './CategoryIcon.tsx';
import { api } from '../services/api.ts';
import type { ProductoStockBajo, ReporteProducto, VentaResumen, VistaId } from '../types/alcohontrol.ts';
import { formatCurrency, formatDateShort, getTodayIso } from '../utils/format.ts';

interface DashboardViewProps {
  searchQuery: string;
  onNavigate: (vista: VistaId) => void;
}

interface ChartPoint {
  label: string;
  actual: number;
  previo: number;
}

interface Coord {
  x: number;
  y: number;
}

const CATEGORY_COLORS = ['#e5a93b', '#38bdf8', '#a855f7', '#22c55e'];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function buildSmoothPath(coords: Coord[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cx = Number(((p0.x + p1.x) / 2).toFixed(2));
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function DashboardView({ searchQuery, onNavigate }: DashboardViewProps) {
  const [productos, setProductos] = useState<ReporteProducto[]>([]);
  const [stockBajo, setStockBajo] = useState<ProductoStockBajo[]>([]);
  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangoDias, setRangoDias] = useState<7 | 14 | 30>(7);
  const [zoomScaleX, setZoomScaleX] = useState(1);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [todayIso] = useState(() => getTodayIso());

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, bajos, ventasList] = await Promise.all([
        api.reportes.productos(),
        api.reportes.stockBajo(),
        api.ventas.listar(),
      ]);
      setProductos(prods);
      setStockBajo(bajos);
      setVentas(ventasList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el resumen operativo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.reportes.productos(), api.reportes.stockBajo(), api.ventas.listar()])
      .then(([prods, bajos, ventasList]) => {
        if (!cancelled) {
          setProductos(prods);
          setStockBajo(bajos);
          setVentas(ventasList);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar el resumen operativo.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const stockCounts = useMemo(() => {
    let optimo = 0;
    let bajo = 0;
    let agotado = 0;
    for (const p of productos) {
      const qty = Number(p.Existencias);
      if (qty <= 0) agotado += 1;
      else if (qty <= 30) bajo += 1;
      else optimo += 1;
    }
    const pct = productos.length === 0 ? 100 : Number(((optimo / productos.length) * 100).toFixed(1));
    return { optimo, bajo, agotado, pct };
  }, [productos]);

  const chartSeries = useMemo<ChartPoint[]>(() => {
    const totalsByDate = new Map<string, number>();
    for (const v of ventas) {
      const key = String(v.FechaVenta).slice(0, 10);
      totalsByDate.set(key, (totalsByDate.get(key) ?? 0) + Number(v.TotalVenta || 0));
    }

    const points: ChartPoint[] = [];
    const [y, m, day] = todayIso.split('-').map(Number);
    const today = new Date(Date.UTC(y, m - 1, day));
    for (let i = rangoDias - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);

      const prevD = new Date(d);
      prevD.setUTCDate(d.getUTCDate() - rangoDias);
      const prevIso = prevD.toISOString().slice(0, 10);

      const label = d
        .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' })
        .replace('.', '')
        .replace('-', ' ');
      points.push({
        label,
        actual: totalsByDate.get(iso) ?? 0,
        previo: totalsByDate.get(prevIso) ?? 0,
      });
    }
    return points;
  }, [ventas, rangoDias, todayIso]);

  const filteredVentas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? ventas.filter(
          (v) =>
            v.Empleado.toLowerCase().includes(q) ||
            String(v.IdVenta).includes(q) ||
            String(v.FechaVenta).includes(q),
        )
      : ventas;
    return list.slice(0, 5);
  }, [ventas, searchQuery]);

  const filteredStockBajo = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? stockBajo.filter(
          (p) => p.Producto.toLowerCase().includes(q) || p.Categoria.toLowerCase().includes(q),
        )
      : stockBajo;
    return list.slice(0, 6);
  }, [stockBajo, searchQuery]);

  // Geometría SVG responsiva y uniforme (28 muestras para morphing suave entre 7d/14d/30d)
  const svgW = 780;
  const svgH = 200;
  const padL = 42;
  const padR = 20;
  const padT = 16;
  const padB = 26;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const maxVal = Math.max(100, ...chartSeries.map((p) => Math.max(p.actual, p.previo))) * 1.15;
  const actualCoords: Coord[] = chartSeries.map((p, idx) => ({
    x: Number((padL + (chartSeries.length > 1 ? (idx / (chartSeries.length - 1)) * plotW : plotW / 2)).toFixed(2)),
    y: Number((padT + plotH - (p.actual / maxVal) * plotH).toFixed(2)),
  }));
  const prevCoords: Coord[] = chartSeries.map((p, idx) => ({
    x: Number((padL + (chartSeries.length > 1 ? (idx / (chartSeries.length - 1)) * plotW : plotW / 2)).toFixed(2)),
    y: Number((padT + plotH - (p.previo / maxVal) * plotH).toFixed(2)),
  }));

  const actualPath = buildSmoothPath(actualCoords);
  const prevPath = buildSmoothPath(prevCoords);
  const areaPath =
    actualCoords.length > 1
      ? `${actualPath} L ${actualCoords[actualCoords.length - 1].x} ${padT + plotH} L ${actualCoords[0].x} ${padT + plotH} Z`
      : '';

  const activeCoord = activeIndex !== null ? actualCoords[activeIndex] : undefined;
  const activePoint = activeIndex !== null ? chartSeries[activeIndex] : undefined;

  // Etiquetas de referencia espaciadas sin saturar el eje X
  const visibleTicks = new Set<number>();
  if (rangoDias <= 7) {
    for (let i = 0; i < chartSeries.length; i++) visibleTicks.add(i);
  } else if (rangoDias <= 14) {
    [0, 3, 6, 9, 13].forEach((i) => {
      if (i < chartSeries.length) visibleTicks.add(i);
    });
  } else {
    [0, 6, 12, 18, 24, 29].forEach((i) => {
      if (i < chartSeries.length) visibleTicks.add(i);
    });
  }

  // Geometría SVG para Gauge semicircular
  const gaugeRadius = 92;
  const gaugeCircumference = Math.PI * gaugeRadius;
  const gaugeDashOffset = gaugeCircumference * (1 - Math.min(100, Math.max(0, stockCounts.pct)) / 100);

  if (loading) {
    return (
      <div className="surface-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Cargando métricas operativas de Alcohontrol…
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <span className="badge badge-danger">Error al cargar</span>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{error}</p>
        <button type="button" className="btn" onClick={() => void cargarDatos()}>
          <ArrowsClockwise size={15} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Resumen Operativo</h1>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '999px',
              background: 'var(--status-ok)',
              boxShadow: '0 0 6px var(--status-ok)',
            }}
          />
          En línea
        </span>
      </div>

      <div className="dashboard-grid">
        {/* COLUMNA CENTRAL (~68%) */}
        <div className="dashboard-left">
          {/* Tarjeta Principal Superior: Gráfico de Tendencia */}
          <section className="surface-card" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Tendencia de Ventas</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Comparativa periodo actual vs periodo previo
                </span>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--bg-canvas)',
                  padding: 3,
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-subtle)',
                  gap: 2,
                }}
              >
                {([7, 14, 30] as const).map((dias) => {
                  const selected = rangoDias === dias;
                  return (
                    <button
                      key={dias}
                      type="button"
                      onClick={() => {
                        if (dias !== rangoDias) {
                          setZoomScaleX(dias > rangoDias ? 1.32 : 0.74);
                          setRangoDias(dias);
                          setActiveIndex(null);
                        }
                      }}
                      style={{
                        position: 'relative',
                        height: 28,
                        padding: '0 12px',
                        border: 'none',
                        borderRadius: 'var(--radius-pill)',
                        background: 'transparent',
                        color: selected ? 'var(--accent-gold-text)' : 'var(--text-secondary)',
                        fontFamily: 'inherit',
                        fontSize: 12,
                        fontWeight: selected ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'color 150ms ease',
                      }}
                    >
                      {selected && (
                        <motion.span
                          layoutId="chart-range-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 'var(--radius-pill)',
                            background: 'var(--accent-gold)',
                            zIndex: 0,
                          }}
                        />
                      )}
                      <span style={{ position: 'relative', zIndex: 1 }}>{dias}d</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{ position: 'relative', width: '100%' }}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                <defs>
                  <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e5a93b" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#e5a93b" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                  const y = padT + plotH * (1 - t);
                  const val = Math.round(maxVal * t);
                  return (
                    <g key={t}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={svgW - padR}
                        y2={y}
                        stroke="rgba(148, 163, 184, 0.08)"
                        strokeDasharray="3 4"
                      />
                      <text
                        x={padL - 8}
                        y={y + 4}
                        textAnchor="end"
                        fill="#64748b"
                        fontSize="11"
                        className="num-tabular"
                      >
                        ${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                      </text>
                    </g>
                  );
                })}

                <motion.g
                  key={rangoDias}
                  initial={{ opacity: 0, scaleX: zoomScaleX, scaleY: 0.94 }}
                  animate={{ opacity: 1, scaleX: 1, scaleY: 1 }}
                  transition={{ duration: 0.36, ease: EASE_OUT }}
                  style={{ transformOrigin: `${svgW - padR}px ${padT + plotH}px` }}
                >
                  {prevPath && (
                    <path
                      d={prevPath}
                      fill="none"
                      stroke="#94a3b8"
                      strokeOpacity="0.4"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  )}

                  {areaPath && <path d={areaPath} fill="url(#goldAreaGrad)" />}

                  {actualPath && (
                    <path
                      d={actualPath}
                      fill="none"
                      stroke="#e5a93b"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}
                </motion.g>

                {activeCoord && activePoint && (
                  <g>
                    <line
                      x1={activeCoord.x}
                      y1={padT}
                      x2={activeCoord.x}
                      y2={padT + plotH}
                      stroke="rgba(229, 169, 59, 0.42)"
                      strokeWidth="1"
                    />
                    <circle
                      cx={activeCoord.x}
                      cy={activeCoord.y}
                      r="5"
                      fill="#e5a93b"
                      stroke="var(--bg-canvas)"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {chartSeries.map((pt, idx) => {
                  const showLabel = visibleTicks.has(idx);
                  return (
                    <g key={`${rangoDias}-${pt.label}`}>
                      {showLabel && (
                        <text
                          x={actualCoords[idx].x}
                          y={svgH - 6}
                          textAnchor="middle"
                          fill={idx === activeIndex ? '#e5a93b' : '#64748b'}
                          fontSize="11"
                        >
                          {pt.label}
                        </text>
                      )}
                      <rect
                        x={actualCoords[idx].x - plotW / (chartSeries.length * 2)}
                        y={padT}
                        width={plotW / chartSeries.length}
                        height={plotH}
                        fill="transparent"
                        style={{ cursor: 'crosshair' }}
                        onMouseEnter={() => setActiveIndex(idx)}
                      />
                    </g>
                  );
                })}
              </svg>

              <AnimatePresence>
                {activePoint && activeCoord && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: EASE_OUT }}
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: `${Math.min(78, Math.max(8, (activeCoord.x / svgW) * 100))}%`,
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(229, 169, 59, 0.4)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '6px 12px',
                      pointerEvents: 'none',
                      boxShadow: '0 10px 24px rgba(0, 0, 0, 0.45)',
                      transition: 'left 130ms var(--ease-out)',
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activePoint.label}</div>
                    <div className="num-tabular" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCurrency(activePoint.actual)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Fila Inferior 62% / 38% */}
          <div className="dashboard-bottom-row">
            <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Últimas Ventas</h2>
                <button
                  type="button"
                  className="btn btn-pill"
                  style={{ height: 30, fontSize: 12 }}
                  onClick={() => onNavigate('cortes')}
                >
                  Ver cortes
                </button>
              </div>

              {filteredVentas.length === 0 ? (
                <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No hay ventas registradas para mostrar.
                </div>
              ) : (
                <div className="scroll-area" style={{ flex: 1 }}>
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th>Piezas</th>
                        <th>Monto</th>
                        <th style={{ textAlign: 'right' }}>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVentas.map((v) => (
                        <tr key={v.IdVenta}>
                          <td style={{ fontWeight: 500 }}>{v.Empleado}</td>
                          <td>
                            <span className="badge badge-neutral num-tabular">{v.TotalArticulosVendidos} uds</span>
                          </td>
                          <td className="num-tabular" style={{ fontWeight: 500 }}>
                            {formatCurrency(v.TotalVenta)}
                          </td>
                          <td className="num-tabular" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatDateShort(v.FechaVenta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Valor de Inventario + Gráfica coherente de Distribución por Categoría */}
            <section
              className="surface-card"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14, minHeight: 0 }}
            >
              <div>
                <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Valor de Inventario</h2>

                <div className="hero-metric" style={{ fontSize: 30, fontWeight: 600 }}>
                  {formatCurrency(valorTotalInventario)}
                </div>
              </div>

              {/* Barra apilada animada + Desglose por Categoría */}
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
                  {distribucionCategorias.map((cat) => (
                    <div
                      key={cat.nombre}
                      style={{
                        width: `${Math.max(4, cat.pct)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: cat.color,
                        transition: 'width 400ms var(--ease-out)',
                      }}
                      title={`${cat.nombre}: ${formatCurrency(cat.valor)} (${cat.pct}%)`}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {distribucionCategorias.map((cat) => (
                    <div
                      key={cat.nombre}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12,
                      }}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
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
                <span style={{ color: 'var(--text-muted)' }}>· {stockBajo.length} en alerta</span>
              </div>
            </section>
          </div>
        </div>

        {/* COLUMNA DERECHA (~32%) */}
        <aside
          className="surface-card"
          style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}
        >
          {/* Mitad Superior: Gauge Semicircular sin recorte tosco */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Salud de Stock</h2>
              <button
                type="button"
                className="btn-circle"
                style={{ width: 32, height: 32 }}
                onClick={() => onNavigate('inventario')}
                title="Ir a Inventario"
              >
                <ArrowRight size={15} />
              </button>
            </div>

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
                {stockCounts.pct.toFixed(1)}%
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
                />

                <path
                  d="M 18 112 A 92 92 0 0 1 202 112"
                  fill="none"
                  stroke="url(#gaugeGoldGrad)"
                  strokeWidth="20"
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeDashOffset}
                  className="gauge-arc-animated"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(229, 169, 59, 0.28))' }}
                />
              </svg>
            </div>
          </div>

          {/* Mitad Inferior: Feed Cronológico de Alertas con ícono por categoría */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>Alertas de Stock</span>
              <span className="badge badge-warn num-tabular">{stockBajo.length}</span>
            </div>

            {filteredStockBajo.length === 0 ? (
              <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Sin productos por debajo del mínimo.
              </div>
            ) : (
              <div className="scroll-area" style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, paddingRight: 4 }}>
                {filteredStockBajo.map((item) => {
                  const agotado = item.Existencias === 0;
                  return (
                    <div
                      key={item.IdProducto}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
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
        </aside>
      </div>
    </div>
  );
}

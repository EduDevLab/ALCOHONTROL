import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowsClockwise,
  BeerBottle,
  DotsThree,
  Funnel,
  Package,
  TrendUp,
  WarningCircle,
} from '@phosphor-icons/react';
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

function buildSmoothPath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cx = (p0.x + p1.x) / 2;
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

  const saludStockPct = useMemo(() => {
    if (productos.length === 0) return 100;
    const saludables = productos.filter((p) => Number(p.Existencias) > 30).length;
    return Number(((saludables / productos.length) * 100).toFixed(2));
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

      const label = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' });
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
    return list.slice(0, 5);
  }, [stockBajo, searchQuery]);

  // Geometría SVG para gráfica de líneas suaves
  const svgW = 680;
  const svgH = 220;
  const padL = 46;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const maxVal = Math.max(100, ...chartSeries.map((p) => Math.max(p.actual, p.previo))) * 1.15;
  const actualCoords = chartSeries.map((p, idx) => ({
    x: padL + (chartSeries.length > 1 ? (idx / (chartSeries.length - 1)) * plotW : plotW / 2),
    y: padT + plotH - (p.actual / maxVal) * plotH,
  }));
  const prevCoords = chartSeries.map((p, idx) => ({
    x: padL + (chartSeries.length > 1 ? (idx / (chartSeries.length - 1)) * plotW : plotW / 2),
    y: padT + plotH - (p.previo / maxVal) * plotH,
  }));

  const actualPath = buildSmoothPath(actualCoords);
  const prevPath = buildSmoothPath(prevCoords);
  const areaPath =
    actualCoords.length > 1
      ? `${actualPath} L ${actualCoords[actualCoords.length - 1].x} ${padT + plotH} L ${actualCoords[0].x} ${padT + plotH} Z`
      : '';

  const hoveredIdx = activeIndex ?? Math.max(0, chartSeries.length - 1);
  const activeCoord = actualCoords[hoveredIdx];
  const activePoint = chartSeries[hoveredIdx];

  // Geometría SVG para Gauge semicircular
  const gaugeRadius = 92;
  const gaugeCircumference = Math.PI * gaugeRadius;
  const gaugeDashOffset = gaugeCircumference * (1 - Math.min(100, Math.max(0, saludStockPct)) / 100);

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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="view-header">
        <h1 className="view-title">Resumen Operativo</h1>
        <button
          type="button"
          className="btn btn-pill"
          onClick={() => setRangoDias((prev) => (prev === 7 ? 14 : prev === 14 ? 30 : 7))}
        >
          <Funnel size={14} />
          Últimos {rangoDias} días
        </button>
      </div>

      <div className="dashboard-grid">
        {/* COLUMNA CENTRAL (~68%) */}
        <div className="dashboard-left">
          {/* Tarjeta Principal Superior: Gráfico de Tendencia */}
          <section className="surface-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Tendencia de Ventas</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Comparativa periodo actual vs periodo previo
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([7, 14, 30] as const).map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    className={`btn btn-pill ${rangoDias === dias ? 'btn-gold' : ''}`}
                    style={{ height: 30, padding: '0 12px', fontSize: 12 }}
                    onClick={() => {
                      setRangoDias(dias);
                      setActiveIndex(null);
                    }}
                  >
                    {dias}d
                  </button>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                <defs>
                  <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e5a93b" stopOpacity="0.22" />
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

                {prevPath && (
                  <path
                    d={prevPath}
                    fill="none"
                    stroke="#94a3b8"
                    strokeOpacity="0.45"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                )}

                {areaPath && <path d={areaPath} fill="url(#goldAreaGrad)" />}

                {actualPath && (
                  <path d={actualPath} fill="none" stroke="#e5a93b" strokeWidth="2.5" strokeLinecap="round" />
                )}

                {activeCoord && activePoint && (
                  <g>
                    <line
                      x1={activeCoord.x}
                      y1={padT}
                      x2={activeCoord.x}
                      y2={padT + plotH}
                      stroke="rgba(229, 169, 59, 0.38)"
                      strokeWidth="1"
                    />
                    <circle
                      cx={activeCoord.x}
                      cy={activeCoord.y}
                      r="5"
                      fill="#e5a93b"
                      stroke="#070d1a"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {chartSeries.map((pt, idx) => {
                  const showLabel = chartSeries.length <= 8 || idx % 2 === 0 || idx === chartSeries.length - 1;
                  return (
                    <g key={pt.label}>
                      {showLabel && (
                        <text
                          x={actualCoords[idx].x}
                          y={svgH - 6}
                          textAnchor="middle"
                          fill={idx === hoveredIdx ? '#e5a93b' : '#64748b'}
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
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setActiveIndex(idx)}
                      />
                    </g>
                  );
                })}
              </svg>

              {activePoint && activeCoord && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: `${Math.min(76, Math.max(8, (activeCoord.x / svgW) * 100))}%`,
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(229, 169, 59, 0.35)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '6px 12px',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activePoint.label}</div>
                  <div className="num-tabular" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatCurrency(activePoint.actual)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Fila Inferior 62% / 38% */}
          <div className="dashboard-bottom-row">
            <section className="surface-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Últimas Ventas</h2>
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
              )}
            </section>

            <section
              className="surface-card"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--radius-xl)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-gold)',
                    }}
                  >
                    <Package size={17} weight="duotone" />
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Valor de Inventario
                  </span>
                </div>
                <DotsThree size={20} color="var(--text-muted)" />
              </div>

              <div
                className="num-tabular"
                style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', margin: '18px 0' }}
              >
                {formatCurrency(valorTotalInventario)}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
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
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 24 }}
        >
          {/* Mitad Superior: Gauge Semicircular */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Salud de Stock</h2>
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
                background: 'rgba(7, 13, 26, 0.45)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px 16px 14px',
                textAlign: 'center',
              }}
            >
              <div className="num-tabular" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>
                {saludStockPct.toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Productos con stock &gt; 30 uds
              </div>

              <svg viewBox="0 0 220 124" style={{ width: '100%', maxWidth: 220, display: 'block', margin: '0 auto' }}>
                <defs>
                  <linearGradient id="gaugeGoldGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#e5a93b" />
                    <stop offset="100%" stopColor="#152340" />
                  </linearGradient>
                  <radialGradient id="gaugeGlow" cx="50%" cy="85%" r="60%">
                    <stop offset="0%" stopColor="#e5a93b" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#e5a93b" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="110" cy="108" r="88" fill="url(#gaugeGlow)" />
                <path
                  d="M 18 108 A 92 92 0 0 1 202 108"
                  fill="none"
                  stroke="#101b33"
                  strokeWidth="22"
                  strokeLinecap="round"
                />
                <path
                  d="M 18 108 A 92 92 0 0 1 202 108"
                  fill="none"
                  stroke="url(#gaugeGoldGrad)"
                  strokeWidth="22"
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeDashOffset}
                />
              </svg>
            </div>
          </div>

          {/* Mitad Inferior: Feed Cronológico de Alertas */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>Alertas de Stock</span>
              <span className="badge badge-warn num-tabular">{stockBajo.length}</span>
            </div>

            {filteredStockBajo.length === 0 ? (
              <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Sin productos por debajo del mínimo.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                          {agotado ? <WarningCircle size={18} /> : <BeerBottle size={18} />}
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

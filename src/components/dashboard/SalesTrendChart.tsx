import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { VentaResumen } from '../../types/alcohontrol.ts';
import { formatCurrency } from '../../utils/format.ts';

interface SalesTrendChartProps {
  ventas: VentaResumen[];
  todayIso: string;
  loading: boolean;
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

export function SalesTrendChart({ ventas, todayIso, loading }: SalesTrendChartProps) {
  const [rangoDias, setRangoDias] = useState<7 | 14 | 30>(7);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

  return (
    <motion.section
      className="surface-card"
      style={{ flexShrink: 0 }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, delay: 0.02, ease: EASE_OUT }}
    >
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

      <div style={{ position: 'relative', width: '100%' }} onMouseLeave={() => setActiveIndex(null)}>
        {loading ? (
          <div className="skeleton" style={{ width: '100%', height: 190 }} />
        ) : (
          <>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e5a93b" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#e5a93b" stopOpacity="0" />
                </linearGradient>
                <clipPath id="plotAreaClip">
                  <rect x={padL} y={padT - 4} width={plotW + 4} height={plotH + 8} />
                </clipPath>
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
                    <text x={padL - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11" className="num-tabular">
                      ${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                    </text>
                  </g>
                );
              })}

              <g key={rangoDias} clipPath="url(#plotAreaClip)" className="chart-plot-enter">
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
                    pathLength={1}
                    className="chart-path-draw"
                    fill="none"
                    stroke="#e5a93b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )}
              </g>

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
          </>
        )}
      </div>
    </motion.section>
  );
}

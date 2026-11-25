import { ArrowCounterClockwise, Trash } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { CategoryIcon } from '../CategoryIcon.tsx';
import { StockBadge } from '../ui/StockBadge.tsx';
import type { ReporteProducto, ZonaCroquis } from '../../types/alcohontrol.ts';
import { formatCurrency } from '../../utils/format.ts';
import {
  DEFAULT_CANVAS_H,
  DEFAULT_CANVAS_W,
  MIN_ZONE_H,
  MIN_ZONE_W,
} from './croquisGeometry.ts';

interface CroquisInspectorProps {
  zonaActiva: ZonaCroquis | null;
  modoEdicion: boolean;
  canvasWidth: number;
  canvasHeight: number;
  catalogo: ReporteProducto[];
  catalogoPorId: Map<number, ReporteProducto>;
  onRenameZona: (id: string, nombre: string) => void;
  onResizeZonaManual: (id: string, dimension: 'width' | 'height', value: number) => void;
  onEliminarZona: (id: string) => void;
  onToggleProducto: (idProducto: number) => void;
  onAjusteRapido: (idProducto: number, delta: number) => void;
  onResetCanvasSize: () => void;
}

export function CroquisInspector({
  zonaActiva,
  modoEdicion,
  canvasWidth,
  canvasHeight,
  catalogo,
  catalogoPorId,
  onRenameZona,
  onResizeZonaManual,
  onEliminarZona,
  onToggleProducto,
  onAjusteRapido,
  onResetCanvasSize,
}: CroquisInspectorProps) {
  const panelKey = `${modoEdicion ? 'edit' : 'live'}-${zonaActiva?.id ?? 'none'}`;
  const isCustomCanvas = canvasWidth !== DEFAULT_CANVAS_W || canvasHeight !== DEFAULT_CANVAS_H;

  return (
    <aside
      className="surface-card"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16, minHeight: 0, overflow: 'hidden' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={panelKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}
        >
          {!zonaActiva ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Selecciona una zona en el croquis.
            </div>
          ) : modoEdicion ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Editar Zona</h2>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ height: 30, padding: '0 8px', color: 'var(--status-danger)' }}
                  onClick={() => onEliminarZona(zonaActiva.id)}
                >
                  <Trash size={14} />
                  Eliminar
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Nombre de zona
                </label>
                <input
                  className="input"
                  value={zonaActiva.nombre}
                  onChange={(e) => onRenameZona(zonaActiva.id, e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Ancho (px)
                  </label>
                  <input
                    type="number"
                    aria-label="Ancho de zona"
                    className="input num-tabular"
                    min={MIN_ZONE_W}
                    max={Math.max(MIN_ZONE_W, canvasWidth - zonaActiva.x)}
                    value={zonaActiva.width}
                    onChange={(e) =>
                      onResizeZonaManual(zonaActiva.id, 'width', Number(e.target.value) || MIN_ZONE_W)
                    }
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Alto (px)
                  </label>
                  <input
                    type="number"
                    aria-label="Alto de zona"
                    className="input num-tabular"
                    min={MIN_ZONE_H}
                    max={Math.max(MIN_ZONE_H, canvasHeight - zonaActiva.y)}
                    value={zonaActiva.height}
                    onChange={(e) =>
                      onResizeZonaManual(zonaActiva.id, 'height', Number(e.target.value) || MIN_ZONE_H)
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Contenedor del croquis</div>
                  <div className="num-tabular" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {canvasWidth} × {canvasHeight} px
                  </div>
                </div>
                {isCustomCanvas && (
                  <button
                    type="button"
                    className="btn"
                    style={{ height: 28, padding: '0 10px', fontSize: 11 }}
                    onClick={onResetCanvasSize}
                    title="Restablecer tamaño base (1100 × 540)"
                  >
                    <ArrowCounterClockwise size={12} />
                    Restablecer
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Productos asignados a {zonaActiva.nombre}
                </div>
                <div
                  className="scroll-area"
                  style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}
                >
                  {catalogo.map((p) => {
                    const checked = zonaActiva.productos.includes(p.IdProducto);
                    return (
                      <label
                        key={p.IdProducto}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-xl)',
                          background: checked ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                          border: `1px solid ${checked ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                          cursor: 'pointer',
                          fontSize: 12,
                          transition: 'border-color 140ms ease, background-color 140ms ease',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleProducto(p.IdProducto)}
                          />
                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', flexShrink: 0 }}>
                            <CategoryIcon categoria={p.Categoria} size={14} />
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.Producto}
                          </span>
                        </span>
                        <span className="num-tabular" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                          {p.Existencias} uds
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{zonaActiva.nombre}</h2>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stock en tiempo real</span>
                </div>
                <span className="badge badge-neutral num-tabular">{zonaActiva.productos.length} productos</span>
              </div>

              {zonaActiva.productos.length === 0 ? (
                <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Esta zona no tiene productos asignados. Usa "Editar croquis" para asignarlos.
                </div>
              ) : (
                <div
                  className="scroll-area"
                  style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}
                >
                  {zonaActiva.productos.map((id) => {
                    const p = catalogoPorId.get(id);
                    if (!p) return null;
                    return (
                      <div
                        key={p.IdProducto}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-xl)',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 10,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--accent-gold)',
                              flexShrink: 0,
                            }}
                          >
                            <CategoryIcon categoria={p.Categoria} size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {p.Producto}
                            </div>
                            <div className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {formatCurrency(p.Precio)} · {p.Categoria}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <StockBadge existencias={p.Existencias} suffix="" showWarningIcon />
                          <button
                            type="button"
                            className="btn"
                            style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                            onClick={() => void onAjusteRapido(p.IdProducto, 6)}
                            title="Entrada rápida +6"
                          >
                            +6
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

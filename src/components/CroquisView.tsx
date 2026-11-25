import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  FloppyDisk,
  PencilSimple,
  Plus,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { CroquisInspector } from './croquis/CroquisInspector.tsx';
import { CroquisZoneItem } from './croquis/CroquisZoneItem.tsx';
import {
  clampZoneMove,
  computeCanvasResize,
  computeMinCanvasSize,
  computeZoneResize,
  DEFAULT_CANVAS_H,
  DEFAULT_CANVAS_W,
  MIN_ZONE_H,
  MIN_ZONE_W,
  type CanvasResizeHandle,
  type Rect,
  type ZoneResizeHandle,
} from './croquis/croquisGeometry.ts';
import { ErrorCard } from './ui/ErrorCard.tsx';
import { api } from '../services/api.ts';
import type { ReporteProducto, ZonaCroquis } from '../types/alcohontrol.ts';

interface CroquisViewProps {
  searchQuery: string;
  onStockChanged: () => void;
}

type InteractionState =
  | {
      type: 'drag-zone';
      id: string;
      startX: number;
      startY: number;
      orig: Rect;
    }
  | {
      type: 'resize-zone';
      id: string;
      handle: ZoneResizeHandle;
      startX: number;
      startY: number;
      orig: Rect;
    }
  | {
      type: 'resize-canvas';
      handle: CanvasResizeHandle;
      startX: number;
      startY: number;
      origW: number;
      origH: number;
      minW: number;
      minH: number;
    };

export function CroquisView({ searchQuery, onStockChanged }: CroquisViewProps) {
  const [zonas, setZonas] = useState<ZonaCroquis[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_W);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_H);
  const [catalogo, setCatalogo] = useState<ReporteProducto[]>([]);
  const [zonaActivaId, setZonaActivaId] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [stageWidth, setStageWidth] = useState(DEFAULT_CANVAS_W + 32);

  const stageRef = useRef<HTMLDivElement | null>(null);

  const cargarCroquis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [croq, prods] = await Promise.all([api.croquis.obtener(), api.reportes.productos()]);
      setZonas(croq.zonas);
      setCanvasWidth(croq.canvasWidth || DEFAULT_CANVAS_W);
      setCanvasHeight(croq.canvasHeight || DEFAULT_CANVAS_H);
      setCatalogo(prods);
      setZonaActivaId((prev) => prev ?? croq.zonas[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el croquis.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.croquis.obtener(), api.reportes.productos()])
      .then(([croq, prods]) => {
        if (!cancelled) {
          setZonas(croq.zonas);
          setCanvasWidth(croq.canvasWidth || DEFAULT_CANVAS_W);
          setCanvasHeight(croq.canvasHeight || DEFAULT_CANVAS_H);
          setCatalogo(prods);
          setZonaActivaId((prev) => prev ?? croq.zonas[0]?.id ?? null);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar el croquis.');
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

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const updateWidth = (width: number) => {
      if (width > 0) {
        setStageWidth(width);
      }
    };

    updateWidth(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  // Escala visual basada únicamente en el ancho disponible del panel y el ancho base,
  // de modo que al arrastrar las manijas del contenedor el reescalado sea 1:1 bajo el cursor.
  const zoom = useMemo(() => {
    const usable = Math.max(320, stageWidth - 34);
    return Math.max(0.55, Math.min(1, usable / DEFAULT_CANVAS_W));
  }, [stageWidth]);

  const canvasMetricsRef = useRef({ canvasWidth, canvasHeight, zoom });
  useEffect(() => {
    canvasMetricsRef.current = { canvasWidth, canvasHeight, zoom };
  }, [canvasWidth, canvasHeight, zoom]);

  useEffect(() => {
    if (!interaction || !modoEdicion) return;

    const handleMove = (ev: PointerEvent) => {
      const { canvasWidth: cw, canvasHeight: ch, zoom: currentZoom } = canvasMetricsRef.current;
      const dx = (ev.clientX - interaction.startX) / currentZoom;
      const dy = (ev.clientY - interaction.startY) / currentZoom;

      if (interaction.type === 'drag-zone') {
        const pos = clampZoneMove(interaction.orig, dx, dy, cw, ch);
        setZonas((prev) =>
          prev.map((z) => (z.id === interaction.id ? { ...z, x: pos.x, y: pos.y } : z)),
        );
        return;
      }

      if (interaction.type === 'resize-zone') {
        const nextRect = computeZoneResize(interaction.orig, interaction.handle, dx, dy, cw, ch);
        setZonas((prev) =>
          prev.map((z) => (z.id === interaction.id ? { ...z, ...nextRect } : z)),
        );
        return;
      }

      const nextSize = computeCanvasResize(
        interaction.origW,
        interaction.origH,
        interaction.handle,
        dx,
        dy,
        interaction.minW,
        interaction.minH,
      );
      setCanvasWidth(nextSize.width);
      setCanvasHeight(nextSize.height);
    };

    const handleEnd = () => {
      setInteraction(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [interaction, modoEdicion]);

  const catalogoPorId = useMemo(() => {
    const map = new Map<number, ReporteProducto>();
    for (const p of catalogo) map.set(p.IdProducto, p);
    return map;
  }, [catalogo]);

  const zonaActiva = useMemo(
    () => zonas.find((z) => z.id === zonaActivaId) ?? zonas[0] ?? null,
    [zonas, zonaActivaId],
  );

  const handleGuardarCroquis = async () => {
    setSaving(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await api.croquis.guardar({
        canvasWidth,
        canvasHeight,
        zonas: zonas.map(({ id, nombre, x, y, width, height, color, productos }) => ({
          id,
          nombre,
          x,
          y,
          width,
          height,
          color,
          productos,
        })),
      });
      setZonas(res.zonas);
      setCanvasWidth(res.canvasWidth || DEFAULT_CANVAS_W);
      setCanvasHeight(res.canvasHeight || DEFAULT_CANVAS_H);
      setModoEdicion(false);
      setInteraction(null);
      setMensaje('Croquis guardado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el croquis.');
    } finally {
      setSaving(false);
    }
  };

  const handleAgregarZona = () => {
    const id = `zona-${Date.now().toString(36)}`;
    const width = Math.min(220, canvasWidth);
    const height = Math.min(150, canvasHeight);
    const nueva: ZonaCroquis = {
      id,
      nombre: `Zona ${zonas.length + 1}`,
      x: Math.min(60, Math.max(0, canvasWidth - width)),
      y: Math.min(60, Math.max(0, canvasHeight - height)),
      width,
      height,
      productos: [],
    };
    setZonas((prev) => [...prev, nueva]);
    setZonaActivaId(id);
  };

  const handleEliminarZona = (id: string) => {
    setZonas((prev) => prev.filter((z) => z.id !== id));
    if (zonaActivaId === id) {
      setZonaActivaId(null);
    }
  };

  const handleRenameZona = (id: string, nombre: string) => {
    setZonas((prev) => prev.map((z) => (z.id === id ? { ...z, nombre } : z)));
  };

  const handleResizeZonaManual = (id: string, dimension: 'width' | 'height', value: number) => {
    setZonas((prev) =>
      prev.map((z) => {
        if (z.id !== id) return z;
        if (dimension === 'width') {
          const clamped = Math.max(MIN_ZONE_W, Math.min(canvasWidth - z.x, Math.round(value)));
          return { ...z, width: clamped };
        }
        const clamped = Math.max(MIN_ZONE_H, Math.min(canvasHeight - z.y, Math.round(value)));
        return { ...z, height: clamped };
      }),
    );
  };

  const toggleProductoEnZona = (idProducto: number) => {
    if (!zonaActiva) return;
    setZonas((prev) =>
      prev.map((z) => {
        if (z.id !== zonaActiva.id) return z;
        const exists = z.productos.includes(idProducto);
        const productos = exists
          ? z.productos.filter((p) => p !== idProducto)
          : [...z.productos, idProducto];
        return { ...z, productos };
      }),
    );
  };

  const handleAjusteRapido = async (idProducto: number, delta: number) => {
    try {
      await api.productos.ajustarExistencias(idProducto, { delta });
      await cargarCroquis();
      onStockChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ajustar el stock.');
    }
  };

  const handleResetCanvasSize = () => {
    const { minW, minH } = computeMinCanvasSize(zonas);
    setCanvasWidth(Math.max(DEFAULT_CANVAS_W, minW));
    setCanvasHeight(Math.max(DEFAULT_CANVAS_H, minH));
  };

  const startCanvasResize = (handle: CanvasResizeHandle, clientX: number, clientY: number) => {
    const { minW, minH } = computeMinCanvasSize(zonas);
    setInteraction({
      type: 'resize-canvas',
      handle,
      startX: clientX,
      startY: clientY,
      origW: canvasWidth,
      origH: canvasHeight,
      minW,
      minH,
    });
  };

  const q = searchQuery.trim().toLowerCase();
  const isResizingCanvas = interaction?.type === 'resize-canvas';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Croquis del Expendio</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {modoEdicion ? (
            <>
              <button type="button" className="btn btn-pill" onClick={handleAgregarZona}>
                <Plus size={14} />
                Nueva zona
              </button>
              <button
                type="button"
                className="btn btn-pill btn-gold"
                disabled={saving}
                onClick={() => void handleGuardarCroquis()}
              >
                <FloppyDisk size={14} weight="bold" />
                {saving ? 'Guardando…' : 'Guardar diseño'}
              </button>
              <button
                type="button"
                className="btn btn-pill"
                onClick={() => {
                  setModoEdicion(false);
                  setInteraction(null);
                  void cargarCroquis();
                }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-pill"
              onClick={() => {
                setMensaje(null);
                setModoEdicion(true);
              }}
            >
              <PencilSimple size={14} />
              Editar croquis
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <div className="badge badge-ok" style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
          <Check size={13} />
          {mensaje}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 68%) minmax(0, 32%)', gap: 20, flex: 1, minHeight: 0 }}>
          <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton" style={{ width: '50%', height: 20 }} />
            <div className="skeleton" style={{ width: '100%', flex: 1, minHeight: 340 }} />
          </section>
          <aside className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton" style={{ width: '60%', height: 24 }} />
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="skeleton" style={{ width: '100%', height: 46 }} />
            ))}
          </aside>
        </div>
      ) : error ? (
        <ErrorCard title="Error" message={error} onRetry={() => void cargarCroquis()} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 68%) minmax(0, 32%)', gap: 20, flex: 1, minHeight: 0 }}>
          {/* Lienzo interactivo */}
          <motion.section
            className="surface-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {modoEdicion
                  ? 'Arrastra las zonas para moverlas o usa las manijas en sus bordes y en el contenedor para reescalar.'
                  : 'Haz clic en una zona para inspeccionar productos y ajustar existencias en tiempo real.'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span className="badge badge-neutral num-tabular">
                  {canvasWidth} × {canvasHeight}
                </span>
                <span className="badge badge-neutral num-tabular">{zonas.length} zonas</span>
              </div>
            </div>

            <div ref={stageRef} className="croquis-stage scroll-area">
              <div
                data-testid="croquis-canvas"
                className={[
                  'croquis-canvas',
                  modoEdicion ? 'is-editing' : '',
                  isResizingCanvas ? 'is-resizing-canvas' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  width: Math.round(canvasWidth * zoom),
                  height: Math.round(canvasHeight * zoom),
                }}
              >
                {zonas.map((z, index) => {
                  const productosZona = z.productos
                    .map((id) => catalogoPorId.get(id))
                    .filter((p): p is ReporteProducto => Boolean(p));
                  const matchSearch =
                    q.length > 0 &&
                    (z.nombre.toLowerCase().includes(q) ||
                      productosZona.some((p) => p.Producto.toLowerCase().includes(q)));
                  const isInteracting =
                    interaction !== null &&
                    (interaction.type === 'drag-zone' || interaction.type === 'resize-zone') &&
                    interaction.id === z.id;

                  return (
                    <CroquisZoneItem
                      key={z.id}
                      zona={z}
                      index={index}
                      canvasWidth={canvasWidth}
                      canvasHeight={canvasHeight}
                      isSelected={zonaActiva?.id === z.id}
                      isEditing={modoEdicion}
                      isInteracting={isInteracting}
                      matchSearch={matchSearch}
                      productosZona={productosZona}
                      onSelect={setZonaActivaId}
                      onStartDrag={(targetZona, e) =>
                        setInteraction({
                          type: 'drag-zone',
                          id: targetZona.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          orig: {
                            x: targetZona.x,
                            y: targetZona.y,
                            width: targetZona.width,
                            height: targetZona.height,
                          },
                        })
                      }
                      onStartResize={(targetZona, handle, e) =>
                        setInteraction({
                          type: 'resize-zone',
                          id: targetZona.id,
                          handle,
                          startX: e.clientX,
                          startY: e.clientY,
                          orig: {
                            x: targetZona.x,
                            y: targetZona.y,
                            width: targetZona.width,
                            height: targetZona.height,
                          },
                        })
                      }
                    />
                  );
                })}

                {modoEdicion && (
                  <>
                    <div
                      role="separator"
                      aria-label="Reescalar ancho del contenedor"
                      data-canvas-handle="e"
                      className="croquis-canvas-handle croquis-canvas-handle-e"
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        startCanvasResize('e', e.clientX, e.clientY);
                      }}
                    />
                    <div
                      role="separator"
                      aria-label="Reescalar alto del contenedor"
                      data-canvas-handle="s"
                      className="croquis-canvas-handle croquis-canvas-handle-s"
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        startCanvasResize('s', e.clientX, e.clientY);
                      }}
                    />
                    <div
                      role="separator"
                      aria-label="Reescalar contenedor completo"
                      data-canvas-handle="se"
                      className="croquis-canvas-handle croquis-canvas-handle-se"
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        startCanvasResize('se', e.clientX, e.clientY);
                      }}
                    />
                  </>
                )}

                {isResizingCanvas && (
                  <span className="croquis-dim-badge" data-testid="canvas-dim-badge">
                    {canvasWidth} × {canvasHeight}
                  </span>
                )}
              </div>
            </div>
          </motion.section>

          {/* Inspector lateral */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            <CroquisInspector
              zonaActiva={zonaActiva}
              modoEdicion={modoEdicion}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              catalogo={catalogo}
              catalogoPorId={catalogoPorId}
              onRenameZona={handleRenameZona}
              onResizeZonaManual={handleResizeZonaManual}
              onEliminarZona={handleEliminarZona}
              onToggleProducto={toggleProductoEnZona}
              onAjusteRapido={handleAjusteRapido}
              onResetCanvasSize={handleResetCanvasSize}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

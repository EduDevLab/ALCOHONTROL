import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  FloppyDisk,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { ErrorCard } from './ui/ErrorCard.tsx';
import { StockBadge } from './ui/StockBadge.tsx';
import { api } from '../services/api.ts';
import type { ReporteProducto, ZonaCroquis } from '../types/alcohontrol.ts';
import { formatCurrency } from '../utils/format.ts';

interface CroquisViewProps {
  searchQuery: string;
  onStockChanged: () => void;
}

const CANVAS_W = 1100;
const CANVAS_H = 540;

export function CroquisView({ searchQuery, onStockChanged }: CroquisViewProps) {
  const [zonas, setZonas] = useState<ZonaCroquis[]>([]);
  const [catalogo, setCatalogo] = useState<ReporteProducto[]>([]);
  const [zonaActivaId, setZonaActivaId] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  const cargarCroquis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [croq, prods] = await Promise.all([api.croquis.obtener(), api.reportes.productos()]);
      setZonas(croq.zonas);
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

  const catalogoPorId = useMemo(() => {
    const map = new Map<number, ReporteProducto>();
    for (const p of catalogo) map.set(p.IdProducto, p);
    return map;
  }, [catalogo]);

  const zonaActiva = useMemo(
    () => zonas.find((z) => z.id === zonaActivaId) ?? zonas[0] ?? null,
    [zonas, zonaActivaId],
  );

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !modoEdicion || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const dx = (e.clientX - dragging.startX) * scaleX;
    const dy = (e.clientY - dragging.startY) * scaleY;

    setZonas((prev) =>
      prev.map((z) => {
        if (z.id !== dragging.id) return z;
        const nextX = Math.max(0, Math.min(CANVAS_W - z.width, Math.round(dragging.origX + dx)));
        const nextY = Math.max(0, Math.min(CANVAS_H - z.height, Math.round(dragging.origY + dy)));
        return { ...z, x: nextX, y: nextY };
      }),
    );
  };

  const handleGuardarCroquis = async () => {
    setSaving(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await api.croquis.guardar(
        zonas.map(({ id, nombre, x, y, width, height, color, productos }) => ({
          id,
          nombre,
          x,
          y,
          width,
          height,
          color,
          productos,
        })),
      );
      setZonas(res.zonas);
      setModoEdicion(false);
      setMensaje('Croquis guardado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el croquis.');
    } finally {
      setSaving(false);
    }
  };

  const handleAgregarZona = () => {
    const id = `zona-${Date.now().toString(36)}`;
    const nueva: ZonaCroquis = {
      id,
      nombre: `Zona ${zonas.length + 1}`,
      x: 60,
      y: 60,
      width: 220,
      height: 150,
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

  const q = searchQuery.trim().toLowerCase();

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
              <button type="button" className="btn btn-pill btn-gold" disabled={saving} onClick={() => void handleGuardarCroquis()}>
                <FloppyDisk size={14} weight="bold" />
                {saving ? 'Guardando…' : 'Guardar diseño'}
              </button>
              <button
                type="button"
                className="btn btn-pill"
                onClick={() => {
                  setModoEdicion(false);
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
          <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {modoEdicion
                  ? 'Arrastra las zonas para moverlas o edita su tamaño y productos en el panel derecho.'
                  : 'Haz clic en una zona para inspeccionar productos y ajustar existencias en tiempo real.'}
              </span>
              <span className="badge badge-neutral num-tabular">{zonas.length} zonas</span>
            </div>

            <div
              ref={canvasRef}
              onPointerMove={handlePointerMove}
              onPointerUp={() => setDragging(null)}
              onPointerLeave={() => setDragging(null)}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
                background: 'var(--bg-canvas)',
                backgroundImage:
                  'radial-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              {zonas.map((z) => {
                const isSelected = zonaActiva?.id === z.id;
                const productosZona = z.productos
                  .map((id) => catalogoPorId.get(id))
                  .filter((p): p is ReporteProducto => Boolean(p));
                const agotados = productosZona.filter((p) => p.Existencias === 0).length;
                const bajos = productosZona.filter((p) => p.Existencias > 0 && p.Existencias <= 30).length;
                const matchSearch =
                  q.length > 0 &&
                  (z.nombre.toLowerCase().includes(q) ||
                    productosZona.some((p) => p.Producto.toLowerCase().includes(q)));

                return (
                  <div
                    key={z.id}
                    onPointerDown={(e) => {
                      setZonaActivaId(z.id);
                      if (modoEdicion) {
                        setDragging({
                          id: z.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          origX: z.x,
                          origY: z.y,
                        });
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${(z.x / CANVAS_W) * 100}%`,
                      top: `${(z.y / CANVAS_H) * 100}%`,
                      width: `${(z.width / CANVAS_W) * 100}%`,
                      height: `${(z.height / CANVAS_H) * 100}%`,
                      background: isSelected ? 'var(--bg-hover)' : 'var(--bg-surface)',
                      border: `1px solid ${
                        isSelected || matchSearch ? 'var(--accent-gold)' : 'var(--border-strong)'
                      }`,
                      borderRadius: 'var(--radius-xl)',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: modoEdicion ? 'grab' : 'pointer',
                      boxShadow: isSelected ? '0 0 20px rgba(229, 169, 59, 0.16)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                        {z.nombre}
                      </span>
                      {agotados > 0 ? (
                        <span className="badge badge-danger num-tabular">{agotados} agot.</span>
                      ) : bajos > 0 ? (
                        <span className="badge badge-warn num-tabular">{bajos} bajo</span>
                      ) : (
                        <span className="badge badge-ok num-tabular">{productosZona.length}</span>
                      )}
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden' }}>
                      {productosZona.length === 0
                        ? 'Sin productos asignados'
                        : productosZona
                            .slice(0, 3)
                            .map((p) => `${p.Producto} (${p.Existencias})`)
                            .join(' · ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Inspector lateral */}
          <aside className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!zonaActiva ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Selecciona una zona en el croquis.</div>
            ) : modoEdicion ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Editar Zona</h2>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ height: 30, padding: '0 8px', color: 'var(--status-danger)' }}
                    onClick={() => handleEliminarZona(zonaActiva.id)}
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
                    onChange={(e) =>
                      setZonas((prev) =>
                        prev.map((z) => (z.id === zonaActiva.id ? { ...z, nombre: e.target.value } : z)),
                      )
                    }
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Ancho (px)
                    </label>
                    <input
                      type="number"
                      className="input num-tabular"
                      min={120}
                      max={CANVAS_W}
                      value={zonaActiva.width}
                      onChange={(e) =>
                        setZonas((prev) =>
                          prev.map((z) =>
                            z.id === zonaActiva.id ? { ...z, width: Math.max(120, Number(e.target.value) || 120) } : z,
                          ),
                        )
                      }
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Alto (px)
                    </label>
                    <input
                      type="number"
                      className="input num-tabular"
                      min={90}
                      max={CANVAS_H}
                      value={zonaActiva.height}
                      onChange={(e) =>
                        setZonas((prev) =>
                          prev.map((z) =>
                            z.id === zonaActiva.id ? { ...z, height: Math.max(90, Number(e.target.value) || 90) } : z,
                          ),
                        )
                      }
                    />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Productos asignados a {zonaActiva.nombre}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
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
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProductoEnZona(p.IdProducto)}
                            />
                            {p.Producto}
                          </span>
                          <span className="num-tabular" style={{ color: 'var(--text-muted)' }}>
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
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Stock en tiempo real
                    </span>
                  </div>
                  <span className="badge badge-neutral num-tabular">{zonaActiva.productos.length} productos</span>
                </div>

                {zonaActiva.productos.length === 0 ? (
                  <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    Esta zona no tiene productos asignados. Usa "Editar croquis" para asignarlos.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
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
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{p.Producto}</div>
                            <div className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {formatCurrency(p.Precio)} · {p.Categoria}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StockBadge existencias={p.Existencias} suffix="" showWarningIcon />
                            <button
                              type="button"
                              className="btn"
                              style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                              onClick={() => void handleAjusteRapido(p.IdProducto, 6)}
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
          </aside>
        </div>
      )}
    </div>
  );
}

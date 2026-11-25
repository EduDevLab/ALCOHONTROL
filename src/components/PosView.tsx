import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowsLeftRight,
  CheckCircle,
  CreditCard,
  Minus,
  Money,
  Plus,
  Receipt,
  ShoppingCart,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { CategoryIcon } from './CategoryIcon.tsx';
import { PosProductCard } from './pos/PosProductCard.tsx';
import { PosTicketModal, type MetodoPago, type PosCartItem } from './pos/PosTicketModal.tsx';
import { ErrorCard } from './ui/ErrorCard.tsx';
import { api } from '../services/api.ts';
import type { Empleado, ReporteProducto } from '../types/alcohontrol.ts';
import { formatCurrency, formatDateShort, getTodayIso } from '../utils/format.ts';

interface PosViewProps {
  empleado: Empleado;
  searchQuery: string;
  onVentaCompletada: () => void;
}

type CategoriaFiltro = 'Todas' | 'Cervezas' | 'Sabritas' | 'Cigarros';

const CATEGORIAS_SWITCH: CategoriaFiltro[] = ['Todas', 'Cervezas', 'Sabritas', 'Cigarros'];
const METODOS_PAGO: Array<{ id: MetodoPago; label: string; icon: typeof Money }> = [
  { id: 'Efectivo', label: 'Efectivo', icon: Money },
  { id: 'Tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'Ambos', label: 'Ambos', icon: ArrowsLeftRight },
];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function PosView({ empleado, searchQuery, onVentaCompletada }: PosViewProps) {
  const [productos, setProductos] = useState<ReporteProducto[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaFiltro>('Todas');
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo');
  const [montoEfectivo, setMontoEfectivo] = useState<string>('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ventaError, setVentaError] = useState<string | null>(null);
  const [ultimoFolio, setUltimoFolio] = useState<{ id: number; total: number; metodo: MetodoPago } | null>(null);
  const [fechaHoy] = useState(() => formatDateShort(getTodayIso()));

  const cargarCatalogo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const prods = await api.reportes.productos();
      setProductos(prods);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.reportes
      .productos()
      .then((prods) => {
        if (!cancelled) {
          setProductos(prods);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
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

  const productosFiltrados = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return productos.filter((p) => {
      const matchCat =
        categoriaActiva === 'Todas' ||
        p.Categoria.trim().toLowerCase() === categoriaActiva.toLowerCase();
      const matchText =
        !q ||
        p.Producto.toLowerCase().includes(q) ||
        p.Categoria.toLowerCase().includes(q) ||
        p.Proveedor.toLowerCase().includes(q);
      return matchCat && matchText;
    });
  }, [productos, categoriaActiva, searchQuery]);

  const agregarCantidad = (prod: ReporteProducto, delta: number) => {
    if (prod.Existencias <= 0 || delta <= 0) return;
    setUltimoFolio(null);
    setVentaError(null);

    setCart((prev) => {
      const existing = prev.find((i) => i.IdProducto === prod.IdProducto);
      if (existing) {
        const nextCantidad = Math.min(prod.Existencias, existing.Cantidad + delta);
        if (nextCantidad === existing.Cantidad) return prev;
        return prev.map((i) =>
          i.IdProducto === prod.IdProducto
            ? { ...i, Cantidad: nextCantidad, ExistenciasMax: prod.Existencias }
            : i,
        );
      }
      return [
        ...prev,
        {
          IdProducto: prod.IdProducto,
          Nombre: prod.Producto,
          Precio: Number(prod.Precio),
          ExistenciasMax: prod.Existencias,
          Cantidad: Math.min(prod.Existencias, delta),
        },
      ];
    });
  };

  const cambiarCantidad = (idProducto: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.IdProducto !== idProducto) return item;
          const next = item.Cantidad + delta;
          if (next <= 0) return null;
          if (next > item.ExistenciasMax) return item;
          return { ...item, Cantidad: next };
        })
        .filter((i): i is PosCartItem => i !== null),
    );
  };

  const totalPiezas = useMemo(() => cart.reduce((acc, i) => acc + i.Cantidad, 0), [cart]);
  const totalTicket = useMemo(() => cart.reduce((acc, i) => acc + i.Cantidad * i.Precio, 0), [cart]);

  const efectivoMixto = Math.min(totalTicket, Math.max(0, Number(montoEfectivo) || 0));
  const tarjetaMixta = Math.max(0, totalTicket - efectivoMixto);

  const handleConfirmarVenta = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setVentaError(null);
    setUltimoFolio(null);

    try {
      const res = await api.ventas.registrar({
        IdEmpleado: empleado.IdEmpleado,
        items: cart.map((i) => ({
          IdProducto: i.IdProducto,
          Cantidad: i.Cantidad,
          PrecioUnitario: i.Precio,
        })),
      });

      setUltimoFolio({
        id: res.venta.IdVenta,
        total: Number(res.venta.TotalVenta ?? totalTicket),
        metodo: metodoPago,
      });
      setCart([]);
      setMontoEfectivo('');
      setConfirmModalOpen(false);
      await cargarCatalogo();
      onVentaCompletada();
    } catch (err) {
      setConfirmModalOpen(false);
      setVentaError(err instanceof Error ? err.message : 'No se pudo completar la venta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="view-title">Punto de Venta</h1>
          <span className="badge badge-neutral">Caja: {empleado.Nombre}</span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            background: 'var(--bg-surface)',
            padding: 4,
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-subtle)',
            gap: 2,
          }}
          role="tablist"
          aria-label="Categorías de productos"
        >
          {CATEGORIAS_SWITCH.map((cat) => {
            const selected = categoriaActiva === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setCategoriaActiva(cat)}
                style={{
                  position: 'relative',
                  height: 32,
                  padding: '0 14px',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  background: 'transparent',
                  color: selected ? 'var(--accent-gold-text)' : 'var(--text-secondary)',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: selected ? 600 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color 150ms ease',
                }}
              >
                {selected && (
                  <motion.span
                    layoutId="pos-cat-pill"
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
                {cat !== 'Todas' && (
                  <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
                    <CategoryIcon categoria={cat} size={14} />
                  </span>
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 62%) minmax(0, 38%)', gap: 20, flex: 1, minHeight: 0 }}>
          <section className="surface-card pos-products-grid">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="skeleton" style={{ width: '100%', height: 148 }} />
            ))}
          </section>
          <aside className="surface-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
            <div className="skeleton" style={{ width: '100%', height: 220 }} />
            <div className="skeleton" style={{ width: '100%', height: 96 }} />
          </aside>
        </div>
      ) : error ? (
        <ErrorCard message={error} onRetry={() => void cargarCatalogo()} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 62%) minmax(0, 38%)', gap: 20, flex: 1, minHeight: 0 }}>
          <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="scroll-area" style={{ flex: 1, paddingRight: 4 }}>
              <AnimatePresence mode="wait">
                {productosFiltrados.length === 0 ? (
                  <motion.div
                    key={`empty-${categoriaActiva}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                    style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    No se encontraron productos con ese filtro.
                  </motion.div>
                ) : (
                  <motion.div
                    key={categoriaActiva}
                    className="pos-products-grid"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                  >
                    {productosFiltrados.map((p) => (
                      <PosProductCard
                        key={p.IdProducto}
                        producto={p}
                        enCarrito={cart.find((i) => i.IdProducto === p.IdProducto)?.Cantidad ?? 0}
                        onAdd={agregarCantidad}
                        onSubtractOne={(id) => cambiarCantidad(id, -1)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          <aside className="surface-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14, minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={18} color="var(--accent-gold)" />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Ticket de Venta</h2>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ height: 28, padding: '0 8px', fontSize: 12 }}
                    onClick={() => setCart([])}
                  >
                    Vaciar
                  </button>
                )}
              </div>

              {ultimoFolio && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--status-ok-soft)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle size={18} color="var(--status-ok)" />
                  <div>
                    <strong>Venta #{ultimoFolio.id} registrada</strong> ({ultimoFolio.metodo}) ·{' '}
                    <span className="num-tabular">{formatCurrency(ultimoFolio.total)}</span>
                  </div>
                </div>
              )}

              {ventaError && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--status-danger-soft)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  <WarningCircle size={18} color="var(--status-danger)" />
                  <span>{ventaError}</span>
                </div>
              )}

              {cart.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                  }}
                >
                  <ShoppingCart size={28} style={{ marginBottom: 8, opacity: 0.6 }} />
                  <div style={{ fontSize: 13 }}>Presiona un producto del catálogo para agregarlo</div>
                </div>
              ) : (
                <div className="scroll-area" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, paddingRight: 4 }}>
                  {cart.map((item) => (
                    <div
                      key={item.IdProducto}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.Nombre}
                        </div>
                        <div className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatCurrency(item.Precio)} c/u · Máx {item.ExistenciasMax}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn-circle"
                          style={{ width: 28, height: 28 }}
                          onClick={() => cambiarCantidad(item.IdProducto, -1)}
                          aria-label="Disminuir cantidad"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="num-tabular" style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>
                          {item.Cantidad}
                        </span>
                        <button
                          type="button"
                          className="btn-circle"
                          style={{ width: 28, height: 28 }}
                          disabled={item.Cantidad >= item.ExistenciasMax}
                          onClick={() => cambiarCantidad(item.IdProducto, 1)}
                          aria-label="Aumentar cantidad"
                        >
                          <Plus size={12} />
                        </button>
                        <span className="num-tabular" style={{ minWidth: 68, textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(item.Cantidad * item.Precio)}
                        </span>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ width: 28, height: 28, padding: 0, borderRadius: 8 }}
                          onClick={() => cambiarCantidad(item.IdProducto, -item.Cantidad)}
                          aria-label="Quitar producto"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, flexShrink: 0 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Método de pago</div>
                <div
                  style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    background: 'var(--bg-canvas)',
                    padding: 3,
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border-subtle)',
                    gap: 3,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 3,
                      bottom: 3,
                      left: 3,
                      width: 'calc((100% - 6px) / 3)',
                      borderRadius: 9,
                      background: 'var(--accent-gold)',
                      transform: `translateX(${METODOS_PAGO.findIndex((m) => m.id === metodoPago) * 100}%)`,
                      transition: 'transform 220ms var(--ease-out)',
                      zIndex: 0,
                      pointerEvents: 'none',
                    }}
                  />
                  {METODOS_PAGO.map((m) => {
                    const selected = metodoPago === m.id;
                    const IconComp = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMetodoPago(m.id)}
                        style={{
                          position: 'relative',
                          height: 32,
                          border: 'none',
                          borderRadius: 9,
                          background: 'transparent',
                          color: selected ? 'var(--accent-gold-text)' : 'var(--text-secondary)',
                          fontFamily: 'inherit',
                          fontSize: 12,
                          fontWeight: selected ? 600 : 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          transition: 'color 150ms ease',
                          zIndex: 1,
                        }}
                      >
                        <IconComp size={14} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence initial={false}>
                  {metodoPago === 'Ambos' && cart.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                            Efectivo
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={totalTicket}
                            step="0.50"
                            className="input num-tabular"
                            style={{ height: 32, fontSize: 12 }}
                            placeholder="$0.00"
                            value={montoEfectivo}
                            onChange={(e) => setMontoEfectivo(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                            Tarjeta
                          </label>
                          <div
                            className="input num-tabular"
                            style={{
                              height: 32,
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {formatCurrency(tarjetaMixta)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>Artículos</span>
                <span className="num-tabular">{totalPiezas}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>Total a cobrar</span>
                <span className="hero-metric" style={{ fontSize: 28, fontWeight: 600 }}>
                  {formatCurrency(totalTicket)}
                </span>
              </div>

              <button
                type="button"
                className="btn btn-gold"
                style={{ width: '100%', height: 44, fontSize: 14 }}
                disabled={cart.length === 0 || submitting}
                onClick={() => setConfirmModalOpen(true)}
              >
                Cobrar {formatCurrency(totalTicket)}
              </button>
            </div>
          </aside>
        </div>
      )}

      <PosTicketModal
        open={confirmModalOpen}
        onClose={() => {
          if (!submitting) setConfirmModalOpen(false);
        }}
        onConfirm={() => void handleConfirmarVenta()}
        submitting={submitting}
        cajeroNombre={empleado.Nombre}
        fechaHoy={fechaHoy}
        metodoPago={metodoPago}
        efectivoMixto={efectivoMixto}
        tarjetaMixta={tarjetaMixta}
        items={cart}
        totalPiezas={totalPiezas}
        totalTicket={totalTicket}
      />
    </div>
  );
}

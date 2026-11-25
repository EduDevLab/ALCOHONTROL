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
  X,
} from '@phosphor-icons/react';
import { CategoryIcon } from './CategoryIcon.tsx';
import { api } from '../services/api.ts';
import type { Empleado, ReporteProducto } from '../types/alcohontrol.ts';
import { formatCurrency, formatDateShort, getTodayIso } from '../utils/format.ts';

interface PosViewProps {
  empleado: Empleado;
  searchQuery: string;
  onVentaCompletada: () => void;
}

interface CartItem {
  IdProducto: number;
  Nombre: string;
  Precio: number;
  ExistenciasMax: number;
  Cantidad: number;
}

type CategoriaFiltro = 'Todas' | 'Cervezas' | 'Sabritas' | 'Cigarros';
type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Ambos';

const CATEGORIAS_SWITCH: CategoriaFiltro[] = ['Todas', 'Cervezas', 'Sabritas', 'Cigarros'];
const METODOS_PAGO: Array<{ id: MetodoPago; label: string; icon: typeof Money }> = [
  { id: 'Efectivo', label: 'Efectivo', icon: Money },
  { id: 'Tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'Ambos', label: 'Ambos', icon: ArrowsLeftRight },
];
const PACK_SIZES = [6, 12, 24] as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function PosView({ empleado, searchQuery, onVentaCompletada }: PosViewProps) {
  const [productos, setProductos] = useState<ReporteProducto[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaFiltro>('Todas');
  const [cart, setCart] = useState<CartItem[]>([]);
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
      const cantidadInicial = Math.min(prod.Existencias, delta);
      return [
        ...prev,
        {
          IdProducto: prod.IdProducto,
          Nombre: prod.Producto,
          Precio: Number(prod.Precio),
          ExistenciasMax: prod.Existencias,
          Cantidad: cantidadInicial,
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
        .filter((i): i is CartItem => i !== null),
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

        {/* Switch compacto de 4 categorías */}
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
          <section className="surface-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: 14, alignContent: 'start' }}>
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
        <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span className="badge badge-danger">Error al cargar</span>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{error}</p>
          <button type="button" className="btn" onClick={() => void cargarCatalogo()}>
            Reintentar
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 62%) minmax(0, 38%)', gap: 20, flex: 1, minHeight: 0 }}>
          {/* Izquierda: Grid de Cards uniformes */}
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
                    {productosFiltrados.map((p) => {
                      const agotado = p.Existencias <= 0;
                      const stockBajo = p.Existencias > 0 && p.Existencias <= 30;
                      const enCarrito = cart.find((i) => i.IdProducto === p.IdProducto)?.Cantidad ?? 0;
                      const lleno = enCarrito >= p.Existencias;
                      const esCerveza = /cerveza/i.test(p.Categoria);

                      return (
                        <div
                          key={p.IdProducto}
                          role="button"
                          tabIndex={agotado ? -1 : 0}
                          aria-disabled={agotado || lleno}
                          className={`pos-product-card ${agotado ? 'is-disabled' : ''} ${
                            enCarrito > 0 ? 'in-cart' : ''
                          }`}
                          onClick={() => {
                            if (!agotado && !lleno) agregarCantidad(p, 1);
                          }}
                          onKeyDown={(e) => {
                            if (!agotado && !lleno && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              agregarCantidad(p, 1);
                            }
                          }}
                        >
                          {/* Fila superior: Categoría + Stock */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                              }}
                            >
                              <span style={{ color: 'var(--accent-gold)', display: 'inline-flex' }}>
                                <CategoryIcon categoria={p.Categoria} size={15} />
                              </span>
                              {p.Categoria}
                            </span>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {enCarrito > 0 && (
                                <span
                                  className="badge num-tabular"
                                  style={{
                                    background: 'var(--accent-gold)',
                                    color: 'var(--accent-gold-text)',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                  }}
                                >
                                  x{enCarrito}
                                </span>
                              )}
                              <span
                                className={`badge num-tabular ${
                                  agotado ? 'badge-danger' : stockBajo ? 'badge-warn' : 'badge-ok'
                                }`}
                              >
                                {p.Existencias}
                              </span>
                            </div>
                          </div>

                          {/* Centro: Nombre y proveedor */}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {p.Producto}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {p.Proveedor}
                            </div>
                          </div>

                          {/* Fila inferior fija (28px): Precio + Botones +6/+12/+24 en hover para Cervezas */}
                          <div
                            style={{
                              height: 28,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <span className="hero-metric" style={{ fontSize: 17, fontWeight: 600 }}>
                              {formatCurrency(p.Precio)}
                            </span>

                            {esCerveza && !agotado && (
                              <div className="pos-pack-actions">
                                {PACK_SIZES.map((pack) => (
                                  <button
                                    key={pack}
                                    type="button"
                                    className="pos-pack-btn num-tabular"
                                    disabled={p.Existencias - enCarrito < pack}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      agregarCantidad(p, pack);
                                    }}
                                    title={`Agregar ${pack} unidades`}
                                  >
                                    +{pack}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Derecha: Ticket activo */}
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
                  <div style={{ fontSize: 13 }}>Presiona una card para agregar 1 unidad al ticket.</div>
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

            {/* Método de pago + Total + Cobrar */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, flexShrink: 0 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Método de pago</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    background: 'var(--bg-canvas)',
                    padding: 3,
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border-subtle)',
                    gap: 3,
                  }}
                >
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
                        }}
                      >
                        {selected && (
                          <motion.span
                            layoutId="pos-pay-pill"
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: 9,
                              background: 'var(--accent-gold)',
                              zIndex: 0,
                            }}
                          />
                        )}
                        <IconComp size={14} style={{ position: 'relative', zIndex: 1 }} />
                        <span style={{ position: 'relative', zIndex: 1 }}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {metodoPago === 'Ambos' && cart.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
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
                )}
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

      {/* Modal de Confirmación de Ticket */}
      <AnimatePresence>
        {confirmModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            onClick={() => !submitting && setConfirmModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(5, 6, 8, 0.72)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 70,
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Confirmación de ticket de venta"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
              className="surface-card"
              style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: 'var(--accent-gold)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Alcohontrol · Expendio Pacífico
                  </div>
                  <h2 style={{ margin: '4px 0 2px', fontSize: 18, fontWeight: 600 }}>Resumen de Ticket</h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Tamazula, Guasave · {fechaHoy}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-circle"
                  style={{ width: 32, height: 32 }}
                  disabled={submitting}
                  onClick={() => setConfirmModalOpen(false)}
                  aria-label="Cerrar"
                >
                  <X size={14} />
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span>Cajero: {empleado.Nombre}</span>
                <span className="badge badge-neutral">
                  {metodoPago === 'Ambos'
                    ? `Efectivo ${formatCurrency(efectivoMixto)} + Tarjeta ${formatCurrency(tarjetaMixta)}`
                    : `Pago: ${metodoPago}`}
                </span>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-subtle)', borderBottom: '1px dashed var(--border-subtle)', padding: '12px 0', maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cart.map((item) => (
                  <div
                    key={item.IdProducto}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, fontSize: 13 }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span className="num-tabular" style={{ color: 'var(--accent-gold)', fontWeight: 600, marginRight: 6 }}>
                        {item.Cantidad}x
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.Nombre}</span>
                      <span className="num-tabular" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                        ({formatCurrency(item.Precio)})
                      </span>
                    </div>
                    <span className="num-tabular" style={{ fontWeight: 600, flexShrink: 0 }}>
                      {formatCurrency(item.Cantidad * item.Precio)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{totalPiezas} artículos</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Total del ticket</div>
                </div>
                <div className="hero-metric" style={{ fontSize: 28, fontWeight: 600, color: 'var(--accent-gold)' }}>
                  {formatCurrency(totalTicket)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={submitting}
                  onClick={() => setConfirmModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-gold"
                  disabled={submitting}
                  onClick={() => void handleConfirmarVenta()}
                >
                  {submitting ? 'Registrando…' : 'Confirmar Ticket'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

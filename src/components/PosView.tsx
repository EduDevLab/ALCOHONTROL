import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  CheckCircle,
  Minus,
  Plus,
  Receipt,
  ShoppingCart,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { api } from '../services/api.ts';
import type { Categoria, Empleado, ReporteProducto } from '../types/alcohontrol.ts';
import { formatCurrency } from '../utils/format.ts';

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

export function PosView({ empleado, searchQuery, onVentaCompletada }: PosViewProps) {
  const [productos, setProductos] = useState<ReporteProducto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Todas');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ventaError, setVentaError] = useState<string | null>(null);
  const [ultimoFolio, setUltimoFolio] = useState<{ id: number; total: number } | null>(null);

  const cargarCatalogo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, cats] = await Promise.all([api.reportes.productos(), api.categorias.listar()]);
      setProductos(prods);
      setCategorias(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.reportes.productos(), api.categorias.listar()])
      .then(([prods, cats]) => {
        if (!cancelled) {
          setProductos(prods);
          setCategorias(cats);
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
      const matchCat = categoriaActiva === 'Todas' || p.Categoria === categoriaActiva;
      const matchText =
        !q ||
        p.Producto.toLowerCase().includes(q) ||
        p.Categoria.toLowerCase().includes(q) ||
        p.Proveedor.toLowerCase().includes(q);
      return matchCat && matchText;
    });
  }, [productos, categoriaActiva, searchQuery]);

  const agregarAlTicket = (prod: ReporteProducto) => {
    if (prod.Existencias <= 0) return;
    setUltimoFolio(null);
    setVentaError(null);

    setCart((prev) => {
      const existing = prev.find((i) => i.IdProducto === prod.IdProducto);
      if (existing) {
        if (existing.Cantidad >= prod.Existencias) return prev;
        return prev.map((i) =>
          i.IdProducto === prod.IdProducto
            ? { ...i, Cantidad: i.Cantidad + 1, ExistenciasMax: prod.Existencias }
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
          Cantidad: 1,
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

  const handleCobrar = async () => {
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

      setUltimoFolio({ id: res.venta.IdVenta, total: Number(res.venta.TotalVenta ?? totalTicket) });
      setCart([]);
      await cargarCatalogo();
      onVentaCompletada();
    } catch (err) {
      setVentaError(err instanceof Error ? err.message : 'No se pudo completar la venta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Punto de Venta</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-neutral">Caja: {empleado.Nombre}</span>
          <button type="button" className="btn btn-pill" onClick={() => void cargarCatalogo()}>
            <ArrowsClockwise size={14} />
            Actualizar stock
          </button>
        </div>
      </div>

      {loading ? (
        <div className="surface-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Cargando catálogo de productos…
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
          {/* Izquierda: Catálogo */}
          <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-pill ${categoriaActiva === 'Todas' ? 'btn-gold' : ''}`}
                style={{ height: 32, fontSize: 12 }}
                onClick={() => setCategoriaActiva('Todas')}
              >
                Todas
              </button>
              {categorias.map((c) => (
                <button
                  key={c.IdCategorias}
                  type="button"
                  className={`btn btn-pill ${categoriaActiva === c.Nombre ? 'btn-gold' : ''}`}
                  style={{ height: 32, fontSize: 12 }}
                  onClick={() => setCategoriaActiva(c.Nombre)}
                >
                  {c.Nombre}
                </button>
              ))}
            </div>

            {productosFiltrados.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                No se encontraron productos con ese filtro.
              </div>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th>Precio</th>
                      <th>Stock</th>
                      <th style={{ textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.map((p) => {
                      const agotado = p.Existencias <= 0;
                      const stockBajo = p.Existencias > 0 && p.Existencias <= 30;
                      const enCarrito = cart.find((i) => i.IdProducto === p.IdProducto)?.Cantidad ?? 0;
                      return (
                        <tr key={p.IdProducto} style={{ opacity: agotado ? 0.5 : 1 }}>
                          <td style={{ fontWeight: 500 }}>{p.Producto}</td>
                          <td>
                            <span className="badge badge-neutral">{p.Categoria}</span>
                          </td>
                          <td className="num-tabular" style={{ fontWeight: 500 }}>
                            {formatCurrency(p.Precio)}
                          </td>
                          <td>
                            <span
                              className={`badge num-tabular ${
                                agotado ? 'badge-danger' : stockBajo ? 'badge-warn' : 'badge-ok'
                              }`}
                            >
                              {p.Existencias} uds
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-pill"
                              style={{ height: 30, padding: '0 12px', fontSize: 12 }}
                              disabled={agotado || enCarrito >= p.Existencias}
                              onClick={() => agregarAlTicket(p)}
                            >
                              <Plus size={13} weight="bold" />
                              {enCarrito > 0 ? `Agregar (${enCarrito})` : 'Agregar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Derecha: Ticket activo */}
          <aside className="surface-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={18} color="var(--accent-gold)" />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Ticket de Venta</h2>
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
                    marginBottom: 14,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--status-ok-soft)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <CheckCircle size={18} color="var(--status-ok)" />
                  <div>
                    <strong>Venta #{ultimoFolio.id} registrada</strong> · Total{' '}
                    <span className="num-tabular">{formatCurrency(ultimoFolio.total)}</span>
                  </div>
                </div>
              )}

              {ventaError && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--status-danger-soft)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <WarningCircle size={18} color="var(--status-danger)" />
                  <span>{ventaError}</span>
                </div>
              )}

              {cart.length === 0 ? (
                <div
                  style={{
                    padding: '48px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                  }}
                >
                  <ShoppingCart size={28} style={{ marginBottom: 8, opacity: 0.6 }} />
                  <div>Selecciona productos de la izquierda para armar el ticket.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 410px)', overflowY: 'auto' }}>
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
                        <span className="num-tabular" style={{ minWidth: 74, textAlign: 'right', fontWeight: 600 }}>
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

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span>Artículos</span>
                <span className="num-tabular">{totalPiezas}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>Total a cobrar</span>
                <span className="num-tabular" style={{ fontSize: 28, fontWeight: 600 }}>
                  {formatCurrency(totalTicket)}
                </span>
              </div>

              <button
                type="button"
                className="btn btn-gold"
                style={{ width: '100%', height: 44, fontSize: 14 }}
                disabled={cart.length === 0 || submitting}
                onClick={() => void handleCobrar()}
              >
                {submitting ? 'Registrando venta…' : `Cobrar ${formatCurrency(totalTicket)}`}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

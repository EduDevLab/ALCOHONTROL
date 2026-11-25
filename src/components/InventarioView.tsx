import { useCallback, useEffect, useMemo, useState } from 'react';
import { PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { api } from '../services/api.ts';
import type { Categoria, Producto, Proveedor, ReporteProducto } from '../types/alcohontrol.ts';
import { formatCurrency } from '../utils/format.ts';

interface InventarioViewProps {
  searchQuery: string;
  onStockChanged: () => void;
}

type TabId = 'productos' | 'categorias' | 'proveedores';

export function InventarioView({ searchQuery, onStockChanged }: InventarioViewProps) {
  const [tab, setTab] = useState<TabId>('productos');
  const [reporteProds, setReporteProds] = useState<ReporteProducto[]>([]);
  const [productosRaw, setProductosRaw] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [filtroCat, setFiltroCat] = useState('Todas');
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modales/formularios
  const [prodForm, setProdForm] = useState<{
    open: boolean;
    id?: number;
    Nombre: string;
    IdCategorias: number;
    Precio: string;
    Existencias: string;
    IdProveedor: number;
  }>({ open: false, Nombre: '', IdCategorias: 0, Precio: '', Existencias: '0', IdProveedor: 0 });

  const [ajusteTarget, setAjusteTarget] = useState<{ id: number; nombre: string; actual: number; delta: string } | null>(
    null,
  );
  const [catForm, setCatForm] = useState<{ open: boolean; id?: number; Nombre: string }>({ open: false, Nombre: '' });
  const [provForm, setProvForm] = useState<{ open: boolean; id?: number; Nombre: string; Telefono: string }>({
    open: false,
    Nombre: '',
    Telefono: '',
  });

  const cargarTodo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rep, raw, cats, provs] = await Promise.all([
        api.reportes.productos(),
        api.productos.listar(),
        api.categorias.listar(),
        api.proveedores.listar(),
      ]);
      setReporteProds(rep);
      setProductosRaw(raw);
      setCategorias(cats);
      setProveedores(provs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar inventario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.reportes.productos(),
      api.productos.listar(),
      api.categorias.listar(),
      api.proveedores.listar(),
    ])
      .then(([rep, raw, cats, provs]) => {
        if (!cancelled) {
          setReporteProds(rep);
          setProductosRaw(raw);
          setCategorias(cats);
          setProveedores(provs);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar inventario.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const prodsFiltrados = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reporteProds.filter((p) => {
      if (filtroCat !== 'Todas' && p.Categoria !== filtroCat) return false;
      if (soloStockBajo && p.Existencias > 30) return false;
      if (!q) return true;
      return (
        p.Producto.toLowerCase().includes(q) ||
        p.Categoria.toLowerCase().includes(q) ||
        p.Proveedor.toLowerCase().includes(q)
      );
    });
  }, [reporteProds, filtroCat, soloStockBajo, searchQuery]);

  const abrirNuevoProducto = () => {
    setActionError(null);
    setProdForm({
      open: true,
      Nombre: '',
      IdCategorias: categorias[0]?.IdCategorias ?? 0,
      Precio: '',
      Existencias: '0',
      IdProveedor: proveedores[0]?.IdProveedor ?? 0,
    });
  };

  const abrirEditarProducto = (id: number) => {
    const raw = productosRaw.find((p) => p.IdProducto === id);
    if (!raw) return;
    setActionError(null);
    setProdForm({
      open: true,
      id: raw.IdProducto,
      Nombre: raw.Nombre,
      IdCategorias: raw.IdCategorias,
      Precio: String(raw.Precio),
      Existencias: String(raw.Existencias),
      IdProveedor: raw.IdProveedor,
    });
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const payload = {
        Nombre: prodForm.Nombre.trim(),
        IdCategorias: prodForm.IdCategorias,
        Precio: Number(prodForm.Precio),
        Existencias: Number(prodForm.Existencias),
        IdProveedor: prodForm.IdProveedor,
      };
      if (prodForm.id) {
        await api.productos.actualizar(prodForm.id, payload);
      } else {
        await api.productos.crear(payload);
      }
      setProdForm((prev) => ({ ...prev, open: false }));
      await cargarTodo();
      onStockChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    }
  };

  const aplicarAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ajusteTarget) return;
    setActionError(null);
    try {
      await api.productos.ajustarExistencias(ajusteTarget.id, { delta: Number(ajusteTarget.delta) });
      setAjusteTarget(null);
      await cargarTodo();
      onStockChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo ajustar el stock.');
    }
  };

  const eliminarProducto = async (id: number) => {
    setActionError(null);
    try {
      await api.productos.eliminar(id);
      await cargarTodo();
      onStockChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el producto.');
    }
  };

  const guardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      if (catForm.id) {
        await api.categorias.actualizar(catForm.id, { Nombre: catForm.Nombre.trim() });
      } else {
        await api.categorias.crear({ Nombre: catForm.Nombre.trim() });
      }
      setCatForm({ open: false, Nombre: '' });
      await cargarTodo();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo guardar la categoría.');
    }
  };

  const eliminarCategoria = async (id: number) => {
    setActionError(null);
    try {
      await api.categorias.eliminar(id);
      await cargarTodo();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar la categoría.');
    }
  };

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      if (provForm.id) {
        await api.proveedores.actualizar(provForm.id, {
          Nombre: provForm.Nombre.trim(),
          Telefono: provForm.Telefono.trim(),
        });
      } else {
        await api.proveedores.crear({
          Nombre: provForm.Nombre.trim(),
          Telefono: provForm.Telefono.trim(),
        });
      }
      setProvForm({ open: false, Nombre: '', Telefono: '' });
      await cargarTodo();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo guardar el proveedor.');
    }
  };

  const eliminarProveedor = async (id: number) => {
    setActionError(null);
    try {
      await api.proveedores.eliminar(id);
      await cargarTodo();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el proveedor.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Inventario y Catálogos</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'productos' && (
            <button type="button" className="btn btn-pill btn-gold" onClick={abrirNuevoProducto}>
              <Plus size={14} weight="bold" />
              Nuevo producto
            </button>
          )}
          {tab === 'categorias' && (
            <button
              type="button"
              className="btn btn-pill btn-gold"
              onClick={() => {
                setActionError(null);
                setCatForm({ open: true, Nombre: '' });
              }}
            >
              <Plus size={14} weight="bold" />
              Nueva categoría
            </button>
          )}
          {tab === 'proveedores' && (
            <button
              type="button"
              className="btn btn-pill btn-gold"
              onClick={() => {
                setActionError(null);
                setProvForm({ open: true, Nombre: '', Telefono: '' });
              }}
            >
              <Plus size={14} weight="bold" />
              Nuevo proveedor
            </button>
          )}
        </div>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(
          [
            ['productos', `Productos (${reporteProds.length})`],
            ['categorias', `Categorías (${categorias.length})`],
            ['proveedores', `Proveedores (${proveedores.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn btn-pill ${tab === id ? 'btn-gold' : ''}`}
            style={{ height: 34, fontSize: 12 }}
            onClick={() => {
              setActionError(null);
              setTab(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="badge badge-danger" style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {loading ? (
        <section className="surface-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton" style={{ width: '40%', height: 30, borderRadius: 999 }} />
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="skeleton" style={{ width: '100%', height: 42 }} />
          ))}
        </section>
      ) : error ? (
        <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span className="badge badge-danger">Error</span>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{error}</p>
          <button type="button" className="btn" onClick={() => void cargarTodo()}>
            Reintentar
          </button>
        </div>
      ) : (
        <section className="surface-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {tab === 'productos' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`btn btn-pill ${filtroCat === 'Todas' ? 'btn-gold' : ''}`}
                    style={{ height: 30, fontSize: 12 }}
                    onClick={() => setFiltroCat('Todas')}
                  >
                    Todas
                  </button>
                  {categorias.map((c) => (
                    <button
                      key={c.IdCategorias}
                      type="button"
                      className={`btn btn-pill ${filtroCat === c.Nombre ? 'btn-gold' : ''}`}
                      style={{ height: 30, fontSize: 12 }}
                      onClick={() => setFiltroCat(c.Nombre)}
                    >
                      {c.Nombre}
                    </button>
                  ))}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={soloStockBajo} onChange={(e) => setSoloStockBajo(e.target.checked)} />
                  Solo stock bajo (≤ 30)
                </label>
              </div>

              {prodsFiltrados.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay productos que coincidan con el filtro.
                </div>
              ) : (
                <div className="scroll-area" style={{ flex: 1 }}>
                  <table className="clean-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th>Proveedor</th>
                      <th>Precio</th>
                      <th>Existencias</th>
                      <th>Valor</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodsFiltrados.map((p) => (
                      <tr key={p.IdProducto}>
                        <td style={{ fontWeight: 500 }}>{p.Producto}</td>
                        <td>
                          <span className="badge badge-neutral">{p.Categoria}</span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.Proveedor}</td>
                        <td className="num-tabular">{formatCurrency(p.Precio)}</td>
                        <td>
                          <span
                            className={`badge num-tabular ${
                              p.Existencias === 0 ? 'badge-danger' : p.Existencias <= 30 ? 'badge-warn' : 'badge-ok'
                            }`}
                          >
                            {p.Existencias} uds
                          </span>
                        </td>
                        <td className="num-tabular">{formatCurrency(p.ValorTotalInventario)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn"
                              style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                              onClick={() =>
                                setAjusteTarget({ id: p.IdProducto, nombre: p.Producto, actual: p.Existencias, delta: '10' })
                              }
                            >
                              + Stock
                            </button>
                            <button
                              type="button"
                              className="btn-circle"
                              style={{ width: 28, height: 28 }}
                              onClick={() => abrirEditarProducto(p.IdProducto)}
                              title="Editar"
                            >
                              <PencilSimple size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-circle"
                              style={{ width: 28, height: 28, color: 'var(--status-danger)' }}
                              onClick={() => void eliminarProducto(p.IdProducto)}
                              title="Eliminar"
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'categorias' && (
            <table className="clean-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.IdCategorias}>
                    <td className="num-tabular" style={{ color: 'var(--text-muted)' }}>
                      #{c.IdCategorias}
                    </td>
                    <td style={{ fontWeight: 500 }}>{c.Nombre}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn-circle"
                          style={{ width: 28, height: 28 }}
                          onClick={() => setCatForm({ open: true, id: c.IdCategorias, Nombre: c.Nombre })}
                        >
                          <PencilSimple size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-circle"
                          style={{ width: 28, height: 28, color: 'var(--status-danger)' }}
                          onClick={() => void eliminarCategoria(c.IdCategorias)}
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'proveedores' && (
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((pr) => (
                  <tr key={pr.IdProveedor}>
                    <td style={{ fontWeight: 500 }}>{pr.Nombre}</td>
                    <td className="num-tabular" style={{ color: 'var(--text-secondary)' }}>
                      {pr.Telefono}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn-circle"
                          style={{ width: 28, height: 28 }}
                          onClick={() =>
                            setProvForm({ open: true, id: pr.IdProveedor, Nombre: pr.Nombre, Telefono: pr.Telefono })
                          }
                        >
                          <PencilSimple size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-circle"
                          style={{ width: 28, height: 28, color: 'var(--status-danger)' }}
                          onClick={() => void eliminarProveedor(pr.IdProveedor)}
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Modal Producto */}
      {prodForm.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 13, 26, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
        >
          <form onSubmit={(e) => void guardarProducto(e)} className="surface-card" style={{ width: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>{prodForm.id ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button type="button" className="btn-circle" style={{ width: 30, height: 30 }} onClick={() => setProdForm((p) => ({ ...p, open: false }))}>
                <X size={14} />
              </button>
            </div>
            <input
              className="input"
              placeholder="Nombre (máx. 30 caracteres)"
              maxLength={30}
              required
              value={prodForm.Nombre}
              onChange={(e) => setProdForm((p) => ({ ...p, Nombre: e.target.value }))}
            />
            <select
              className="select"
              value={prodForm.IdCategorias}
              onChange={(e) => setProdForm((p) => ({ ...p, IdCategorias: Number(e.target.value) }))}
            >
              {categorias.map((c) => (
                <option key={c.IdCategorias} value={c.IdCategorias}>
                  {c.Nombre}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={prodForm.IdProveedor}
              onChange={(e) => setProdForm((p) => ({ ...p, IdProveedor: Number(e.target.value) }))}
            >
              {proveedores.map((pr) => (
                <option key={pr.IdProveedor} value={pr.IdProveedor}>
                  {pr.Nombre}
                </option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input num-tabular"
                placeholder="Precio"
                required
                value={prodForm.Precio}
                onChange={(e) => setProdForm((p) => ({ ...p, Precio: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                className="input num-tabular"
                placeholder="Existencias"
                required
                value={prodForm.Existencias}
                onChange={(e) => setProdForm((p) => ({ ...p, Existencias: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn-gold">
              Guardar producto
            </button>
          </form>
        </div>
      )}

      {/* Modal Ajuste de Stock */}
      {ajusteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 13, 26, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
        >
          <form onSubmit={(e) => void aplicarAjuste(e)} className="surface-card" style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Ajustar Stock · {ajusteTarget.nombre}</h2>
              <button type="button" className="btn-circle" style={{ width: 30, height: 30 }} onClick={() => setAjusteTarget(null)}>
                <X size={14} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Existencias actuales: <strong className="num-tabular">{ajusteTarget.actual} uds</strong>. Usa valores positivos para entrada o negativos para merma.
            </div>
            <input
              type="number"
              className="input num-tabular"
              required
              value={ajusteTarget.delta}
              onChange={(e) => setAjusteTarget((prev) => (prev ? { ...prev, delta: e.target.value } : null))}
            />
            <button type="submit" className="btn btn-gold">
              Aplicar ajuste
            </button>
          </form>
        </div>
      )}

      {/* Modal Categoría */}
      {catForm.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 13, 26, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
        >
          <form onSubmit={(e) => void guardarCategoria(e)} className="surface-card" style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>{catForm.id ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
              <button type="button" className="btn-circle" style={{ width: 30, height: 30 }} onClick={() => setCatForm({ open: false, Nombre: '' })}>
                <X size={14} />
              </button>
            </div>
            <input
              className="input"
              placeholder="Nombre de categoría"
              maxLength={50}
              required
              value={catForm.Nombre}
              onChange={(e) => setCatForm((p) => ({ ...p, Nombre: e.target.value }))}
            />
            <button type="submit" className="btn btn-gold">
              Guardar
            </button>
          </form>
        </div>
      )}

      {/* Modal Proveedor */}
      {provForm.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 13, 26, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
        >
          <form onSubmit={(e) => void guardarProveedor(e)} className="surface-card" style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>{provForm.id ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              <button type="button" className="btn-circle" style={{ width: 30, height: 30 }} onClick={() => setProvForm({ open: false, Nombre: '', Telefono: '' })}>
                <X size={14} />
              </button>
            </div>
            <input
              className="input"
              placeholder="Nombre del proveedor"
              maxLength={30}
              required
              value={provForm.Nombre}
              onChange={(e) => setProvForm((p) => ({ ...p, Nombre: e.target.value }))}
            />
            <input
              className="input num-tabular"
              placeholder="Teléfono (10 dígitos)"
              pattern="\d{10}"
              maxLength={10}
              required
              value={provForm.Telefono}
              onChange={(e) => setProvForm((p) => ({ ...p, Telefono: e.target.value }))}
            />
            <button type="submit" className="btn btn-gold">
              Guardar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

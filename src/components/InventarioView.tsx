import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Package, Plus, Tag, Truck, WarningCircle, X } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import {
  InventarioModals,
  type AjusteTarget,
  type CatFormState,
  type DeleteTarget,
  type ProdFormState,
  type ProvFormState,
} from './inventario/InventarioModals.tsx';
import { InventarioTables, type InventarioTabId } from './inventario/InventarioTables.tsx';
import { ErrorCard } from './ui/ErrorCard.tsx';
import { api } from '../services/api.ts';
import type { Categoria, Producto, Proveedor, ReporteProducto } from '../types/alcohontrol.ts';

interface InventarioViewProps {
  searchQuery: string;
  onStockChanged: () => void;
}

interface FeedbackNotice {
  type: 'success' | 'error';
  text: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function InventarioView({ searchQuery, onStockChanged }: InventarioViewProps) {
  const [tab, setTab] = useState<InventarioTabId>('productos');
  const [reporteProds, setReporteProds] = useState<ReporteProducto[]>([]);
  const [productosRaw, setProductosRaw] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [filtroCat, setFiltroCat] = useState('Todas');
  const [soloStockBajo, setSoloStockBajo] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackNotice | null>(null);

  const [prodForm, setProdForm] = useState<ProdFormState>({
    open: false,
    Nombre: '',
    IdCategorias: 0,
    Precio: '',
    Existencias: '0',
    IdProveedor: 0,
  });
  const [ajusteTarget, setAjusteTarget] = useState<AjusteTarget | null>(null);
  const [catForm, setCatForm] = useState<CatFormState>({ open: false, Nombre: '' });
  const [provForm, setProvForm] = useState<ProvFormState>({ open: false, Nombre: '', Telefono: '' });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

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

  useEffect(() => {
    if (!feedback || feedback.type !== 'success') return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

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

  const totalStockBajo = useMemo(
    () => reporteProds.filter((p) => p.Existencias <= 30).length,
    [reporteProds],
  );

  const conteoPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of reporteProds) {
      map.set(p.Categoria, (map.get(p.Categoria) ?? 0) + 1);
    }
    return map;
  }, [reporteProds]);

  const conteoPorProveedor = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of reporteProds) {
      map.set(p.Proveedor, (map.get(p.Proveedor) ?? 0) + 1);
    }
    return map;
  }, [reporteProds]);

  const abrirNuevoProducto = () => {
    setFeedback(null);
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
    setFeedback(null);
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
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const nombre = prodForm.Nombre.trim();
      const payload = {
        Nombre: nombre,
        IdCategorias: prodForm.IdCategorias,
        Precio: Number(prodForm.Precio),
        Existencias: Number(prodForm.Existencias),
        IdProveedor: prodForm.IdProveedor,
      };
      if (prodForm.id) {
        await api.productos.actualizar(prodForm.id, payload);
        setFeedback({ type: 'success', text: `Producto "${nombre}" actualizado correctamente.` });
      } else {
        await api.productos.crear(payload);
        setFeedback({ type: 'success', text: `Producto "${nombre}" agregado al catálogo.` });
      }
      setProdForm((prev) => ({ ...prev, open: false }));
      await cargarTodo();
      onStockChanged();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo guardar el producto.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const aplicarAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ajusteTarget || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const delta = Number(ajusteTarget.delta);
      const res = await api.productos.ajustarExistencias(ajusteTarget.id, { delta });
      setFeedback({
        type: 'success',
        text: `Stock de "${ajusteTarget.nombre}" actualizado a ${res.Existencias} uds.`,
      });
      setAjusteTarget(null);
      await cargarTodo();
      onStockChanged();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo ajustar el stock.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const guardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const nombre = catForm.Nombre.trim();
      if (catForm.id) {
        await api.categorias.actualizar(catForm.id, { Nombre: nombre });
        setFeedback({ type: 'success', text: `Categoría "${nombre}" actualizada.` });
      } else {
        await api.categorias.crear({ Nombre: nombre });
        setFeedback({ type: 'success', text: `Categoría "${nombre}" creada.` });
      }
      setCatForm({ open: false, Nombre: '' });
      await cargarTodo();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo guardar la categoría.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const nombre = provForm.Nombre.trim();
      const telefono = provForm.Telefono.trim();
      if (provForm.id) {
        await api.proveedores.actualizar(provForm.id, { Nombre: nombre, Telefono: telefono });
        setFeedback({ type: 'success', text: `Proveedor "${nombre}" actualizado.` });
      } else {
        await api.proveedores.crear({ Nombre: nombre, Telefono: telefono });
        setFeedback({ type: 'success', text: `Proveedor "${nombre}" registrado.` });
      }
      setProvForm({ open: false, Nombre: '', Telefono: '' });
      await cargarTodo();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo guardar el proveedor.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmarEliminacion = async () => {
    if (!deleteTarget || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (deleteTarget.kind === 'producto') {
        await api.productos.eliminar(deleteTarget.id);
        setFeedback({ type: 'success', text: `Producto "${deleteTarget.nombre}" eliminado.` });
        onStockChanged();
      } else if (deleteTarget.kind === 'categoria') {
        await api.categorias.eliminar(deleteTarget.id);
        setFeedback({ type: 'success', text: `Categoría "${deleteTarget.nombre}" eliminada.` });
      } else {
        await api.proveedores.eliminar(deleteTarget.id);
        setFeedback({ type: 'success', text: `Proveedor "${deleteTarget.nombre}" eliminado.` });
      }
      setDeleteTarget(null);
      await cargarTodo();
    } catch (err) {
      setDeleteTarget(null);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo completar la eliminación.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: Array<{ id: InventarioTabId; label: string; count: number; icon: typeof Package }> = [
    { id: 'productos', label: 'Productos', count: reporteProds.length, icon: Package },
    { id: 'categorias', label: 'Categorías', count: categorias.length, icon: Tag },
    { id: 'proveedores', label: 'Proveedores', count: proveedores.length, icon: Truck },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Inventario y Catálogos</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="segmented-control" role="tablist" aria-label="Secciones de inventario">
            {tabs.map(({ id, label, count, icon: Icon }) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`segmented-btn ${selected ? 'is-active' : ''}`}
                  onClick={() => {
                    setFeedback(null);
                    setTab(id);
                  }}
                >
                  {selected && (
                    <motion.span
                      layoutId="inv-tab-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="segmented-pill"
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
                    <Icon size={14} weight={selected ? 'bold' : 'regular'} />
                  </span>
                  <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
                  <span
                    className="num-tabular"
                    style={{ position: 'relative', zIndex: 1, opacity: selected ? 0.85 : 0.65 }}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

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
                setFeedback(null);
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
                setFeedback(null);
                setProvForm({ open: true, Nombre: '', Telefono: '' });
              }}
            >
              <Plus size={14} weight="bold" />
              Nuevo proveedor
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.text}
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className={`inv-feedback-banner ${feedback.type === 'success' ? 'is-success' : 'is-error'}`}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {feedback.type === 'success' ? (
                <CheckCircle size={16} weight="fill" />
              ) : (
                <WarningCircle size={16} weight="fill" />
              )}
              {feedback.text}
            </span>
            <button
              type="button"
              className="btn-ghost"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                padding: 4,
              }}
              onClick={() => setFeedback(null)}
              aria-label="Cerrar aviso"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <section className="surface-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton" style={{ width: '44%', height: 34, borderRadius: 999 }} />
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="skeleton" style={{ width: '100%', height: 42 }} />
          ))}
        </section>
      ) : error ? (
        <ErrorCard title="Error" message={error} onRetry={() => void cargarTodo()} />
      ) : (
        <motion.section
          className="surface-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <InventarioTables
            tab={tab}
            prodsFiltrados={prodsFiltrados}
            categorias={categorias}
            proveedores={proveedores}
            conteoPorCategoria={conteoPorCategoria}
            conteoPorProveedor={conteoPorProveedor}
            filtroCat={filtroCat}
            soloStockBajo={soloStockBajo}
            totalStockBajo={totalStockBajo}
            onChangeFiltroCat={setFiltroCat}
            onToggleStockBajo={() => setSoloStockBajo((v) => !v)}
            onOpenAjuste={(p) => {
              setFeedback(null);
              setAjusteTarget({ id: p.IdProducto, nombre: p.Producto, actual: p.Existencias, delta: '6' });
            }}
            onEditProducto={abrirEditarProducto}
            onRequestDeleteProducto={(p) =>
              setDeleteTarget({ kind: 'producto', id: p.IdProducto, nombre: p.Producto })
            }
            onEditCategoria={(c) => {
              setFeedback(null);
              setCatForm({ open: true, id: c.IdCategorias, Nombre: c.Nombre });
            }}
            onRequestDeleteCategoria={(c) =>
              setDeleteTarget({
                kind: 'categoria',
                id: c.IdCategorias,
                nombre: c.Nombre,
                relatedCount: conteoPorCategoria.get(c.Nombre) ?? 0,
              })
            }
            onEditProveedor={(pr) => {
              setFeedback(null);
              setProvForm({ open: true, id: pr.IdProveedor, Nombre: pr.Nombre, Telefono: pr.Telefono });
            }}
            onRequestDeleteProveedor={(pr) =>
              setDeleteTarget({
                kind: 'proveedor',
                id: pr.IdProveedor,
                nombre: pr.Nombre,
                relatedCount: conteoPorProveedor.get(pr.Nombre) ?? 0,
              })
            }
          />
        </motion.section>
      )}

      <InventarioModals
        categorias={categorias}
        proveedores={proveedores}
        submitting={submitting}
        prodForm={prodForm}
        setProdForm={setProdForm}
        onSubmitProducto={(e) => void guardarProducto(e)}
        ajusteTarget={ajusteTarget}
        setAjusteTarget={setAjusteTarget}
        onSubmitAjuste={(e) => void aplicarAjuste(e)}
        catForm={catForm}
        setCatForm={setCatForm}
        onSubmitCategoria={(e) => void guardarCategoria(e)}
        provForm={provForm}
        setProvForm={setProvForm}
        onSubmitProveedor={(e) => void guardarProveedor(e)}
        deleteTarget={deleteTarget}
        onCloseDelete={() => setDeleteTarget(null)}
        onConfirmDelete={() => void confirmarEliminacion()}
      />
    </div>
  );
}

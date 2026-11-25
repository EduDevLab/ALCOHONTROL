import { PencilSimple, Phone, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { CategoryIcon } from '../CategoryIcon.tsx';
import { StockBadge } from '../ui/StockBadge.tsx';
import type { Categoria, Proveedor, ReporteProducto } from '../../types/alcohontrol.ts';
import { formatCurrency } from '../../utils/format.ts';

export type InventarioTabId = 'productos' | 'categorias' | 'proveedores';

interface InventarioTablesProps {
  tab: InventarioTabId;
  prodsFiltrados: ReporteProducto[];
  categorias: Categoria[];
  proveedores: Proveedor[];
  conteoPorCategoria: Map<string, number>;
  conteoPorProveedor: Map<string, number>;
  filtroCat: string;
  soloStockBajo: boolean;
  totalStockBajo: number;
  onChangeFiltroCat: (cat: string) => void;
  onToggleStockBajo: () => void;
  onOpenAjuste: (prod: ReporteProducto) => void;
  onEditProducto: (id: number) => void;
  onRequestDeleteProducto: (prod: ReporteProducto) => void;
  onEditCategoria: (cat: Categoria) => void;
  onRequestDeleteCategoria: (cat: Categoria) => void;
  onEditProveedor: (prov: Proveedor) => void;
  onRequestDeleteProveedor: (prov: Proveedor) => void;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function InventarioTables({
  tab,
  prodsFiltrados,
  categorias,
  proveedores,
  conteoPorCategoria,
  conteoPorProveedor,
  filtroCat,
  soloStockBajo,
  totalStockBajo,
  onChangeFiltroCat,
  onToggleStockBajo,
  onOpenAjuste,
  onEditProducto,
  onRequestDeleteProducto,
  onEditCategoria,
  onRequestDeleteCategoria,
  onEditProveedor,
  onRequestDeleteProveedor,
}: InventarioTablesProps) {
  const catOptions = ['Todas', ...categorias.map((c) => c.Nombre)];

  return (
    <AnimatePresence mode="wait">
      {tab === 'productos' && (
        <motion.div
          key="productos"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div className="segmented-control" role="tablist" aria-label="Filtrar por categoría">
              {catOptions.map((cat) => {
                const selected = filtroCat === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={`segmented-btn ${selected ? 'is-active' : ''}`}
                    onClick={() => onChangeFiltroCat(cat)}
                  >
                    {selected && (
                      <motion.span
                        layoutId="inv-cat-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="segmented-pill"
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

            <button
              type="button"
              className={`inv-filter-toggle ${soloStockBajo ? 'is-active' : ''}`}
              aria-pressed={soloStockBajo}
              onClick={onToggleStockBajo}
            >
              <WarningCircle size={14} weight={soloStockBajo ? 'fill' : 'regular'} />
              <span>Solo stock bajo</span>
              <span className="num-tabular" style={{ opacity: 0.85 }}>
                ({totalStockBajo})
              </span>
            </button>
          </div>

          {prodsFiltrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No hay productos que coincidan con el filtro seleccionado.
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
                    <th style={{ textAlign: 'right', width: 164 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {prodsFiltrados.map((p) => (
                    <tr key={p.IdProducto} className="inv-row">
                      <td style={{ fontWeight: 500 }}>{p.Producto}</td>
                      <td>
                        <span className="badge badge-neutral">
                          <CategoryIcon categoria={p.Categoria} size={13} />
                          {p.Categoria}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.Proveedor}</td>
                      <td className="num-tabular">{formatCurrency(p.Precio)}</td>
                      <td>
                        <StockBadge existencias={p.Existencias} showWarningIcon />
                      </td>
                      <td className="num-tabular">{formatCurrency(p.ValorTotalInventario)}</td>
                      <td style={{ textAlign: 'right', width: 164 }}>
                        <div className="inv-row-actions">
                          <button
                            type="button"
                            className="btn"
                            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                            onClick={() => onOpenAjuste(p)}
                          >
                            <Plus size={12} weight="bold" />
                            Stock
                          </button>
                          <button
                            type="button"
                            className="btn-circle"
                            style={{ width: 28, height: 28 }}
                            onClick={() => onEditProducto(p.IdProducto)}
                            title="Editar producto"
                            aria-label={`Editar ${p.Producto}`}
                          >
                            <PencilSimple size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-circle"
                            style={{ width: 28, height: 28, color: 'var(--status-danger)' }}
                            onClick={() => onRequestDeleteProducto(p)}
                            title="Eliminar producto"
                            aria-label={`Eliminar ${p.Producto}`}
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
        </motion.div>
      )}

      {tab === 'categorias' && (
        <motion.div
          key="categorias"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          {categorias.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No hay categorías registradas todavía.
            </div>
          ) : (
            <div className="scroll-area" style={{ flex: 1 }}>
              <table className="clean-table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>ID</th>
                    <th>Categoría</th>
                    <th>Productos vinculados</th>
                    <th style={{ textAlign: 'right', width: 100 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((c) => {
                    const count = conteoPorCategoria.get(c.Nombre) ?? 0;
                    return (
                      <tr key={c.IdCategorias} className="inv-row">
                        <td className="num-tabular" style={{ color: 'var(--text-muted)' }}>
                          #{c.IdCategorias}
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                            <span
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 10,
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--accent-gold)',
                              }}
                            >
                              <CategoryIcon categoria={c.Nombre} size={15} />
                            </span>
                            {c.Nombre}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-neutral num-tabular">
                            {count} {count === 1 ? 'producto' : 'productos'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', width: 100 }}>
                          <div className="inv-row-actions">
                            <button
                              type="button"
                              className="btn-circle"
                              style={{ width: 28, height: 28 }}
                              onClick={() => onEditCategoria(c)}
                              title="Editar categoría"
                              aria-label={`Editar ${c.Nombre}`}
                            >
                              <PencilSimple size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-circle"
                              style={{ width: 28, height: 28, color: 'var(--status-danger)' }}
                              onClick={() => onRequestDeleteCategoria(c)}
                              title="Eliminar categoría"
                              aria-label={`Eliminar ${c.Nombre}`}
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {tab === 'proveedores' && (
        <motion.div
          key="proveedores"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          {proveedores.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No hay proveedores registrados todavía.
            </div>
          ) : (
            <div className="scroll-area" style={{ flex: 1 }}>
              <table className="clean-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Teléfono</th>
                    <th>Productos vinculados</th>
                    <th style={{ textAlign: 'right', width: 100 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map((pr) => {
                    const count = conteoPorProveedor.get(pr.Nombre) ?? 0;
                    return (
                      <tr key={pr.IdProveedor} className="inv-row">
                        <td style={{ fontWeight: 500 }}>{pr.Nombre}</td>
                        <td className="num-tabular" style={{ color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Phone size={13} color="var(--text-muted)" />
                            {pr.Telefono}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-neutral num-tabular">
                            {count} {count === 1 ? 'producto' : 'productos'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', width: 100 }}>
                          <div className="inv-row-actions">
                            <button
                              type="button"
                              className="btn-circle"
                              style={{ width: 28, height: 28 }}
                              onClick={() => onEditProveedor(pr)}
                              title="Editar proveedor"
                              aria-label={`Editar ${pr.Nombre}`}
                            >
                              <PencilSimple size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-circle"
                              style={{ width: 28, height: 28, color: 'var(--status-danger)' }}
                              onClick={() => onRequestDeleteProveedor(pr)}
                              title="Eliminar proveedor"
                              aria-label={`Eliminar ${pr.Nombre}`}
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

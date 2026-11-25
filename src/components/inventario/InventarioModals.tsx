import { WarningCircle } from '@phosphor-icons/react';
import { Modal } from '../ui/Modal.tsx';
import type { Categoria, Proveedor } from '../../types/alcohontrol.ts';

export interface ProdFormState {
  open: boolean;
  id?: number;
  Nombre: string;
  IdCategorias: number;
  Precio: string;
  Existencias: string;
  IdProveedor: number;
}

export interface AjusteTarget {
  id: number;
  nombre: string;
  actual: number;
  delta: string;
}

export interface CatFormState {
  open: boolean;
  id?: number;
  Nombre: string;
}

export interface ProvFormState {
  open: boolean;
  id?: number;
  Nombre: string;
  Telefono: string;
}

export interface DeleteTarget {
  kind: 'producto' | 'categoria' | 'proveedor';
  id: number;
  nombre: string;
  relatedCount?: number;
}

interface InventarioModalsProps {
  categorias: Categoria[];
  proveedores: Proveedor[];
  submitting: boolean;
  prodForm: ProdFormState;
  setProdForm: React.Dispatch<React.SetStateAction<ProdFormState>>;
  onSubmitProducto: (e: React.FormEvent) => void;
  ajusteTarget: AjusteTarget | null;
  setAjusteTarget: React.Dispatch<React.SetStateAction<AjusteTarget | null>>;
  onSubmitAjuste: (e: React.FormEvent) => void;
  catForm: CatFormState;
  setCatForm: React.Dispatch<React.SetStateAction<CatFormState>>;
  onSubmitCategoria: (e: React.FormEvent) => void;
  provForm: ProvFormState;
  setProvForm: React.Dispatch<React.SetStateAction<ProvFormState>>;
  onSubmitProveedor: (e: React.FormEvent) => void;
  deleteTarget: DeleteTarget | null;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}

const AJUSTE_PRESETS = [-6, -1, 6, 12, 24];

const DELETE_TITLES: Record<DeleteTarget['kind'], string> = {
  producto: 'Eliminar producto',
  categoria: 'Eliminar categoría',
  proveedor: 'Eliminar proveedor',
};

const FIELD_LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

export function InventarioModals({
  categorias,
  proveedores,
  submitting,
  prodForm,
  setProdForm,
  onSubmitProducto,
  ajusteTarget,
  setAjusteTarget,
  onSubmitAjuste,
  catForm,
  setCatForm,
  onSubmitCategoria,
  provForm,
  setProvForm,
  onSubmitProveedor,
  deleteTarget,
  onCloseDelete,
  onConfirmDelete,
}: InventarioModalsProps) {
  const deltaNum = ajusteTarget ? Number(ajusteTarget.delta) : 0;
  const ajusteValido = ajusteTarget !== null && Number.isFinite(deltaNum) && deltaNum !== 0;
  const stockResultante = ajusteTarget ? ajusteTarget.actual + (Number.isFinite(deltaNum) ? deltaNum : 0) : 0;

  return (
    <>
      <Modal
        open={prodForm.open}
        onClose={() => setProdForm((p) => ({ ...p, open: false }))}
        eyebrow={prodForm.id ? 'Edición' : 'Nuevo registro'}
        title={prodForm.id ? 'Editar Producto' : 'Nuevo Producto'}
        disableClose={submitting}
        width={450}
      >
        <form onSubmit={onSubmitProducto} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={FIELD_LABEL_STYLE}>Nombre del producto</label>
            <input
              className="input"
              placeholder="Ej. Pacífico Media 355 ml"
              maxLength={30}
              required
              value={prodForm.Nombre}
              onChange={(e) => setProdForm((p) => ({ ...p, Nombre: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={FIELD_LABEL_STYLE}>Categoría</label>
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
            </div>
            <div>
              <label style={FIELD_LABEL_STYLE}>Proveedor</label>
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
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={FIELD_LABEL_STYLE}>Precio ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="input num-tabular"
                placeholder="0.00"
                required
                value={prodForm.Precio}
                onChange={(e) => setProdForm((p) => ({ ...p, Precio: e.target.value }))}
              />
            </div>
            <div>
              <label style={FIELD_LABEL_STYLE}>Existencias</label>
              <input
                type="number"
                min="0"
                className="input num-tabular"
                placeholder="0"
                required
                value={prodForm.Existencias}
                onChange={(e) => setProdForm((p) => ({ ...p, Existencias: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-pill"
              disabled={submitting}
              onClick={() => setProdForm((p) => ({ ...p, open: false }))}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-pill btn-gold" disabled={submitting}>
              {submitting ? 'Guardando…' : prodForm.id ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(ajusteTarget)}
        onClose={() => setAjusteTarget(null)}
        eyebrow="Ajuste rápido"
        title={ajusteTarget ? ajusteTarget.nombre : 'Ajustar Stock'}
        subtitle="Usa valores positivos para entrada o negativos para merma."
        disableClose={submitting}
        width={400}
      >
        {ajusteTarget && (
          <form onSubmit={onSubmitAjuste} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                Actual: <strong className="num-tabular">{ajusteTarget.actual} uds</strong>
              </span>
              <span
                className="num-tabular"
                style={{
                  fontWeight: 600,
                  color: stockResultante < 0 ? 'var(--status-danger)' : 'var(--accent-gold)',
                }}
              >
                Nuevo stock: {stockResultante} uds
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AJUSTE_PRESETS.map((preset) => {
                const label = preset > 0 ? `+${preset}` : String(preset);
                const selected = Number(ajusteTarget.delta) === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    className={`btn btn-pill ${selected ? 'btn-gold' : ''}`}
                    style={{ height: 30, padding: '0 11px', fontSize: 12 }}
                    onClick={() =>
                      setAjusteTarget((prev) => (prev ? { ...prev, delta: String(preset) } : null))
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div>
              <label style={FIELD_LABEL_STYLE}>Cantidad a ajustar</label>
              <input
                type="number"
                className="input num-tabular"
                required
                value={ajusteTarget.delta}
                onChange={(e) => setAjusteTarget((prev) => (prev ? { ...prev, delta: e.target.value } : null))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-pill"
                disabled={submitting}
                onClick={() => setAjusteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-pill btn-gold"
                disabled={submitting || !ajusteValido || stockResultante < 0}
              >
                {submitting ? 'Aplicando…' : 'Aplicar ajuste'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={catForm.open}
        onClose={() => setCatForm({ open: false, Nombre: '' })}
        eyebrow={catForm.id ? 'Edición' : 'Nuevo registro'}
        title={catForm.id ? 'Editar Categoría' : 'Nueva Categoría'}
        disableClose={submitting}
        width={390}
      >
        <form onSubmit={onSubmitCategoria} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={FIELD_LABEL_STYLE}>Nombre de categoría</label>
            <input
              className="input"
              placeholder="Ej. Cervezas artesanales"
              maxLength={50}
              required
              value={catForm.Nombre}
              onChange={(e) => setCatForm((p) => ({ ...p, Nombre: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-pill"
              disabled={submitting}
              onClick={() => setCatForm({ open: false, Nombre: '' })}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-pill btn-gold" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={provForm.open}
        onClose={() => setProvForm({ open: false, Nombre: '', Telefono: '' })}
        eyebrow={provForm.id ? 'Edición' : 'Nuevo registro'}
        title={provForm.id ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        disableClose={submitting}
        width={410}
      >
        <form onSubmit={onSubmitProveedor} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={FIELD_LABEL_STYLE}>Nombre del proveedor</label>
            <input
              className="input"
              placeholder="Ej. Distribuidora Pacífico"
              maxLength={30}
              required
              value={provForm.Nombre}
              onChange={(e) => setProvForm((p) => ({ ...p, Nombre: e.target.value }))}
            />
          </div>

          <div>
            <label style={FIELD_LABEL_STYLE}>Teléfono (10 dígitos)</label>
            <input
              className="input num-tabular"
              placeholder="6871234567"
              pattern="\d{10}"
              maxLength={10}
              required
              value={provForm.Telefono}
              onChange={(e) => setProvForm((p) => ({ ...p, Telefono: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-pill"
              disabled={submitting}
              onClick={() => setProvForm({ open: false, Nombre: '', Telefono: '' })}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-pill btn-gold" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={onCloseDelete}
        eyebrow="Confirmar eliminación"
        title={deleteTarget ? DELETE_TITLES[deleteTarget.kind] : 'Eliminar'}
        disableClose={submitting}
        width={420}
      >
        {deleteTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 'var(--radius-xl)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.28)',
                color: '#fca5a5',
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              <WarningCircle size={18} weight="fill" style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: 1 }} />
              <div>
                ¿Seguro que deseas eliminar <strong>{deleteTarget.nombre}</strong>? Esta acción no se puede deshacer.
                {(deleteTarget.relatedCount ?? 0) > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Aviso: tiene <strong className="num-tabular">{deleteTarget.relatedCount}</strong>{' '}
                    {deleteTarget.relatedCount === 1 ? 'producto asociado' : 'productos asociados'}. La base de datos
                    impedirá eliminarla mientras sigan vinculados.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-pill" disabled={submitting} onClick={onCloseDelete}>
                Cancelar
              </button>
              <button type="button" className="btn btn-pill btn-danger" disabled={submitting} onClick={onConfirmDelete}>
                {submitting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

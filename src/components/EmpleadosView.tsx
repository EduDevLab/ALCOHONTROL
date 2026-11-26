import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  PencilSimple,
  Phone,
  Plus,
  Trash,
  Users,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { ErrorCard } from './ui/ErrorCard.tsx';
import { Modal } from './ui/Modal.tsx';
import { api } from '../services/api.ts';
import { esAdministrador, type Empleado } from '../types/alcohontrol.ts';

interface EmpleadosViewProps {
  searchQuery: string;
}

type RoleFilter = 'todos' | 'cajero' | 'admin';

interface FeedbackNotice {
  type: 'success' | 'error';
  text: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const FIELD_LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

function getInitials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function EmpleadosView({ searchQuery }: EmpleadosViewProps) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('todos');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackNotice | null>(null);

  const [form, setForm] = useState<{
    open: boolean;
    id?: number;
    Nombre: string;
    Puesto: string;
    Telefono: string;
  }>({
    open: false,
    Nombre: '',
    Puesto: 'Cajero',
    Telefono: '',
  });
  const [deleteTarget, setDeleteTarget] = useState<Empleado | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.empleados.listar();
      setEmpleados(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar personal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.empleados
      .listar()
      .then((data) => {
        if (!cancelled) {
          setEmpleados(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar personal.');
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

  const counts = useMemo(() => {
    const admins = empleados.filter((e) => esAdministrador(e.Puesto)).length;
    return {
      todos: empleados.length,
      admin: admins,
      cajero: empleados.length - admins,
    };
  }, [empleados]);

  const filtrados = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return empleados.filter((emp) => {
      const isAdmin = esAdministrador(emp.Puesto);
      if (roleFilter === 'admin' && !isAdmin) return false;
      if (roleFilter === 'cajero' && isAdmin) return false;
      if (!q) return true;
      return (
        emp.Nombre.toLowerCase().includes(q) ||
        emp.Puesto.toLowerCase().includes(q) ||
        emp.Telefono.toLowerCase().includes(q)
      );
    });
  }, [empleados, roleFilter, searchQuery]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const nombre = form.Nombre.trim();
      const payload = {
        Nombre: nombre,
        Puesto: form.Puesto.trim(),
        Telefono: form.Telefono.trim(),
      };
      if (form.id) {
        await api.empleados.actualizar(form.id, payload);
        setFeedback({ type: 'success', text: `Datos de "${nombre}" actualizados.` });
      } else {
        await api.empleados.crear(payload);
        setFeedback({ type: 'success', text: `Empleado "${nombre}" registrado correctamente.` });
      }
      setForm({ open: false, Nombre: '', Puesto: 'Cajero', Telefono: '' });
      await cargar();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo guardar el empleado.',
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
      await api.empleados.eliminar(deleteTarget.IdEmpleado);
      setFeedback({ type: 'success', text: `Empleado "${deleteTarget.Nombre}" eliminado.` });
      setDeleteTarget(null);
      await cargar();
    } catch (err) {
      setDeleteTarget(null);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo eliminar el empleado.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const roleTabs: Array<{ id: RoleFilter; label: string; count: number }> = [
    { id: 'todos', label: 'Todos', count: counts.todos },
    { id: 'cajero', label: 'Cajeros', count: counts.cajero },
    { id: 'admin', label: 'Administradores', count: counts.admin },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Personal del Expendio</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="segmented-control" role="tablist" aria-label="Filtrar por puesto">
            {roleTabs.map(({ id, label, count }) => {
              const selected = roleFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`segmented-btn ${selected ? 'is-active' : ''}`}
                  onClick={() => setRoleFilter(id)}
                >
                  {selected && (
                    <motion.span
                      layoutId="emp-role-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="segmented-pill"
                    />
                  )}
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

          <button
            type="button"
            className="btn btn-pill btn-gold"
            onClick={() => {
              setFeedback(null);
              setForm({ open: true, Nombre: '', Puesto: 'Cajero', Telefono: '' });
            }}
          >
            <Plus size={14} weight="bold" />
            Nuevo empleado
          </button>
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
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="skeleton" style={{ width: '100%', height: 46 }} />
          ))}
        </section>
      ) : error ? (
        <ErrorCard title="Error" message={error} onRetry={() => void cargar()} />
      ) : (
        <motion.section
          className="surface-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              flexShrink: 0,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              <Users size={16} color="var(--accent-gold)" />
              Turnos y permisos de acceso
            </span>
            <span className="badge badge-neutral num-tabular">
              {filtrados.length} {filtrados.length === 1 ? 'empleado' : 'empleados'}
            </span>
          </div>

          {filtrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No hay empleados que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="scroll-area" style={{ flex: 1 }}>
              <table className="clean-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Puesto</th>
                    <th>Teléfono</th>
                    <th style={{ textAlign: 'right', width: 100 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((emp) => {
                    const isAdmin = esAdministrador(emp.Puesto);
                    return (
                      <tr key={emp.IdEmpleado} className="inv-row">
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                            <span
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 10,
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--accent-gold)',
                                fontSize: 11,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {getInitials(emp.Nombre)}
                            </span>
                            {emp.Nombre}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${isAdmin ? 'badge-gold' : 'badge-neutral'}`}>
                            {emp.Puesto}
                          </span>
                        </td>
                        <td className="num-tabular" style={{ color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Phone size={13} color="var(--text-muted)" />
                            {emp.Telefono}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', width: 100 }}>
                          <div className="inv-row-actions">
                            <button
                              type="button"
                              className="btn-circle"
                              style={{ width: 28, height: 28 }}
                              onClick={() => {
                                setFeedback(null);
                                setForm({
                                  open: true,
                                  id: emp.IdEmpleado,
                                  Nombre: emp.Nombre,
                                  Puesto: emp.Puesto,
                                  Telefono: emp.Telefono,
                                });
                              }}
                              title="Editar empleado"
                              aria-label={`Editar ${emp.Nombre}`}
                            >
                              <PencilSimple size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-circle"
                              style={{ width: 28, height: 28, color: 'var(--status-danger)' }}
                              onClick={() => setDeleteTarget(emp)}
                              title="Eliminar empleado"
                              aria-label={`Eliminar ${emp.Nombre}`}
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
        </motion.section>
      )}

      <Modal
        open={form.open}
        onClose={() => setForm((p) => ({ ...p, open: false }))}
        eyebrow={form.id ? 'Edición' : 'Nuevo registro'}
        title={form.id ? 'Editar Empleado' : 'Nuevo Empleado'}
        disableClose={submitting}
        width={420}
      >
        <form onSubmit={(e) => void guardar(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="emp-nombre" style={FIELD_LABEL_STYLE}>
              Nombre completo
            </label>
            <input
              id="emp-nombre"
              className="input"
              placeholder="Ej. Carlos Ruiz"
              maxLength={100}
              required
              value={form.Nombre}
              onChange={(e) => setForm((p) => ({ ...p, Nombre: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="emp-puesto" style={FIELD_LABEL_STYLE}>
              Puesto
            </label>
            <select
              id="emp-puesto"
              className="select"
              value={form.Puesto}
              onChange={(e) => setForm((p) => ({ ...p, Puesto: e.target.value }))}
            >
              <option value="Cajero">Cajero</option>
              <option value="Administrador">Administrador</option>
            </select>
          </div>

          <div>
            <label htmlFor="emp-telefono" style={FIELD_LABEL_STYLE}>
              Teléfono (10 dígitos)
            </label>
            <input
              id="emp-telefono"
              className="input num-tabular"
              placeholder="6871234567"
              pattern="\d{10}"
              maxLength={10}
              required
              value={form.Telefono}
              onChange={(e) => setForm((p) => ({ ...p, Telefono: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-pill"
              disabled={submitting}
              onClick={() => setForm((p) => ({ ...p, open: false }))}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-pill btn-gold" disabled={submitting}>
              {submitting ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear empleado'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        eyebrow="Confirmar eliminación"
        title="Eliminar empleado"
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
              <WarningCircle
                size={18}
                weight="fill"
                style={{ color: 'var(--status-danger)', flexShrink: 0, marginTop: 1 }}
              />
              <div>
                ¿Seguro que deseas eliminar a <strong>{deleteTarget.Nombre}</strong>? Esta acción no se puede deshacer.
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  Si el empleado tiene ventas registradas en el historial, la base de datos impedirá eliminarlo para
                  proteger la integridad de los cortes.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-pill"
                disabled={submitting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-pill btn-danger"
                disabled={submitting}
                onClick={() => void confirmarEliminacion()}
              >
                {submitting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

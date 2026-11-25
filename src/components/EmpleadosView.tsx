import { useCallback, useEffect, useState } from 'react';
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { ErrorCard } from './ui/ErrorCard.tsx';
import { Modal } from './ui/Modal.tsx';
import { api } from '../services/api.ts';
import type { Empleado } from '../types/alcohontrol.ts';

export function EmpleadosView() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; id?: number; Nombre: string; Puesto: string; Telefono: string }>({
    open: false,
    Nombre: '',
    Puesto: 'Cajero',
    Telefono: '',
  });

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

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      if (form.id) {
        await api.empleados.actualizar(form.id, {
          Nombre: form.Nombre.trim(),
          Puesto: form.Puesto.trim(),
          Telefono: form.Telefono.trim(),
        });
      } else {
        await api.empleados.crear({
          Nombre: form.Nombre.trim(),
          Puesto: form.Puesto.trim(),
          Telefono: form.Telefono.trim(),
        });
      }
      setForm({ open: false, Nombre: '', Puesto: 'Cajero', Telefono: '' });
      await cargar();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo guardar el empleado.');
    }
  };

  const eliminar = async (id: number) => {
    setActionError(null);
    try {
      await api.empleados.eliminar(id);
      await cargar();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el empleado.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Personal del Expendio</h1>
        <button
          type="button"
          className="btn btn-pill btn-gold"
          onClick={() => {
            setActionError(null);
            setForm({ open: true, Nombre: '', Puesto: 'Cajero', Telefono: '' });
          }}
        >
          <Plus size={14} weight="bold" />
          Nuevo empleado
        </button>
      </div>

      {actionError && (
        <div className="badge badge-danger" style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {loading ? (
        <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="skeleton" style={{ width: '100%', height: 42 }} />
          ))}
        </section>
      ) : error ? (
        <ErrorCard title="Error" message={error} onRetry={() => void cargar()} />
      ) : (
        <section className="surface-card">
          <table className="clean-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Puesto</th>
                <th>Teléfono</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((emp) => (
                <tr key={emp.IdEmpleado}>
                  <td style={{ fontWeight: 500 }}>{emp.Nombre}</td>
                  <td>
                    <span className="badge badge-neutral">{emp.Puesto}</span>
                  </td>
                  <td className="num-tabular" style={{ color: 'var(--text-secondary)' }}>
                    {emp.Telefono}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn-circle"
                        style={{ width: 28, height: 28 }}
                        onClick={() =>
                          setForm({
                            open: true,
                            id: emp.IdEmpleado,
                            Nombre: emp.Nombre,
                            Puesto: emp.Puesto,
                            Telefono: emp.Telefono,
                          })
                        }
                      >
                        <PencilSimple size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-circle"
                        style={{ width: 28, height: 28, color: 'var(--status-danger)' }}
                        onClick={() => void eliminar(emp.IdEmpleado)}
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Modal
        open={form.open}
        onClose={() => setForm((p) => ({ ...p, open: false }))}
        title={form.id ? 'Editar Empleado' : 'Nuevo Empleado'}
        width={420}
      >
        <form onSubmit={(e) => void guardar(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            className="input"
            placeholder="Nombre completo"
            maxLength={100}
            required
            value={form.Nombre}
            onChange={(e) => setForm((p) => ({ ...p, Nombre: e.target.value }))}
          />
          <select
            className="select"
            value={form.Puesto}
            onChange={(e) => setForm((p) => ({ ...p, Puesto: e.target.value }))}
          >
            <option value="Cajero">Cajero</option>
            <option value="Administrador">Administrador</option>
          </select>
          <input
            className="input num-tabular"
            placeholder="Teléfono (10 dígitos)"
            pattern="\d{10}"
            maxLength={10}
            required
            value={form.Telefono}
            onChange={(e) => setForm((p) => ({ ...p, Telefono: e.target.value }))}
          />
          <button type="submit" className="btn btn-gold">
            Guardar empleado
          </button>
        </form>
      </Modal>
    </div>
  );
}

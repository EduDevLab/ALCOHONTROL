import { useCallback, useEffect, useState } from 'react';
import { PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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
        <div className="surface-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Cargando personal…
        </div>
      ) : error ? (
        <div className="surface-card" style={{ color: 'var(--status-danger)' }}>
          {error}
        </div>
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

      {form.open && (
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
          <form onSubmit={(e) => void guardar(e)} className="surface-card" style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>{form.id ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
              <button type="button" className="btn-circle" style={{ width: 30, height: 30 }} onClick={() => setForm((p) => ({ ...p, open: false }))}>
                <X size={14} />
              </button>
            </div>
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
        </div>
      )}
    </div>
  );
}

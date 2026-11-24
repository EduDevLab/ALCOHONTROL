import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { api } from '../services/api.ts';
import { esAdministrador, type Empleado } from '../types/alcohontrol.ts';

interface TurnoSelectorProps {
  onSelect: (empleado: Empleado) => void;
}

export function TurnoSelector({ onSelect }: TurnoSelectorProps) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarEmpleados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.empleados.listar();
      setEmpleados(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.');
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
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.');
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

  return (
    <div className="turno-screen">
      <div className="turno-panel">
        <div className="turno-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--accent-gold)',
              }}
            >
              Alcohontrol · Expendio Pacífico
            </span>
            <span className="badge badge-neutral">Tamazula, Guasave</span>
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600 }}>Selección de Turno</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            Elige el empleado activo para iniciar operaciones en caja e inventario.
          </p>
        </div>

        {loading && (
          <div style={{ padding: '40px 28px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Cargando personal registrado…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div className="badge badge-danger">Error de conexión</div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>{error}</p>
            <button type="button" className="btn" onClick={() => void cargarEmpleados()}>
              <RefreshCw size={14} />
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && empleados.length === 0 && (
          <div style={{ padding: '40px 28px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No hay empleados registrados en la base de datos.
          </div>
        )}

        {!loading && !error && empleados.length > 0 && (
          <div className="turno-list">
            {empleados.map((emp) => {
              const isAdmin = esAdministrador(emp.Puesto);
              return (
                <button key={emp.IdEmpleado} type="button" className="turno-row" onClick={() => onSelect(emp)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isAdmin ? 'var(--accent-gold)' : 'var(--text-secondary)',
                      }}
                    >
                      {isAdmin ? <ShieldCheck size={18} /> : <User size={18} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{emp.Nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                        <span>{emp.Puesto}</span>
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span className="num-tabular">{emp.Telefono}</span>
                      </div>
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Iniciar turno
                    <ArrowRight size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

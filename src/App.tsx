import { useEffect, useState } from 'react';
import { Shell } from './components/Shell.tsx';
import { TurnoSelector } from './components/TurnoSelector.tsx';
import { api } from './services/api.ts';
import { esAdministrador, type Empleado, type ProductoStockBajo, type VistaId } from './types/alcohontrol.ts';

const STORAGE_KEY = 'alcohontrol_empleado_activo';

function readStoredEmpleado(): Empleado | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Empleado) : null;
  } catch {
    return null;
  }
}

export function App() {
  const [empleado, setEmpleado] = useState<Empleado | null>(() => readStoredEmpleado());
  const [vistaActiva, setVistaActiva] = useState<VistaId>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockBajo, setStockBajo] = useState<ProductoStockBajo[]>([]);

  useEffect(() => {
    if (!empleado) return;
    let cancelled = false;
    api.reportes
      .stockBajo()
      .then((data) => {
        if (!cancelled) {
          setStockBajo(data);
        }
      })
      .catch(() => {
        // Silencioso en barra superior si el servidor aún está iniciando
      });
    return () => {
      cancelled = true;
    };
  }, [empleado, vistaActiva]);

  const handleSelectEmpleado = (selected: Empleado) => {
    setEmpleado(selected);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    setVistaActiva('dashboard');
  };

  const handleCerrarTurno = () => {
    setEmpleado(null);
    localStorage.removeItem(STORAGE_KEY);
    setSearchQuery('');
  };

  if (!empleado) {
    return <TurnoSelector onSelect={handleSelectEmpleado} />;
  }

  const vistaEfectiva: VistaId =
    vistaActiva === 'empleados' && !esAdministrador(empleado.Puesto) ? 'dashboard' : vistaActiva;

  return (
    <Shell
      empleado={empleado}
      vistaActiva={vistaEfectiva}
      onCambiarVista={setVistaActiva}
      onCerrarTurno={handleCerrarTurno}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      stockBajo={stockBajo}
    >
      <div className="surface-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Módulo: {vistaEfectiva}</h2>
          <span className="badge badge-ok">API conectada · Base lista</span>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
          Shell de escritorio y capa de servicios listos. Siguiente paso: Fase 3 para implementar las pantallas
          operativas.
        </p>
      </div>
    </Shell>
  );
}

export default App;

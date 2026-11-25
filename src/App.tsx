import { useEffect, useState } from 'react';
import { CortesView } from './components/CortesView.tsx';
import { CroquisView } from './components/CroquisView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { EmpleadosView } from './components/EmpleadosView.tsx';
import { InventarioView } from './components/InventarioView.tsx';
import { PosView } from './components/PosView.tsx';
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
  const [alertTick, setAlertTick] = useState(0);

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
  }, [empleado, vistaActiva, alertTick]);

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

  const refreshAlerts = () => setAlertTick((t) => t + 1);

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
      <div key={vistaEfectiva} className="view-stage">
        {vistaEfectiva === 'dashboard' && (
          <DashboardView searchQuery={searchQuery} onNavigate={setVistaActiva} />
        )}
        {vistaEfectiva === 'pos' && (
          <PosView empleado={empleado} searchQuery={searchQuery} onVentaCompletada={refreshAlerts} />
        )}
        {vistaEfectiva === 'croquis' && (
          <CroquisView searchQuery={searchQuery} onStockChanged={refreshAlerts} />
        )}
        {vistaEfectiva === 'inventario' && (
          <InventarioView searchQuery={searchQuery} onStockChanged={refreshAlerts} />
        )}
        {vistaEfectiva === 'cortes' && <CortesView />}
        {vistaEfectiva === 'empleados' && <EmpleadosView />}
      </div>
    </Shell>
  );
}

export default App;

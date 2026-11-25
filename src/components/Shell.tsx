import { useEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  ChartBar,
  MagnifyingGlass,
  MapTrifold,
  Package,
  ShoppingCart,
  SignOut,
  SquaresFour,
  Users,
  type Icon,
} from '@phosphor-icons/react';
import { esAdministrador, type Empleado, type ProductoStockBajo, type VistaId } from '../types/alcohontrol.ts';

interface NavItem {
  id: VistaId;
  label: string;
  icon: Icon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Resumen Operativo', icon: SquaresFour },
  { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart },
  { id: 'croquis', label: 'Croquis del Expendio', icon: MapTrifold },
  { id: 'inventario', label: 'Inventario y Catálogos', icon: Package },
  { id: 'cortes', label: 'Cortes y Reportes', icon: ChartBar },
  { id: 'empleados', label: 'Personal', icon: Users, adminOnly: true },
];

interface ShellProps {
  empleado: Empleado;
  vistaActiva: VistaId;
  onCambiarVista: (vista: VistaId) => void;
  onCerrarTurno: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  stockBajo: ProductoStockBajo[];
  children: ReactNode;
}

function getInitials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function Shell({
  empleado,
  vistaActiva,
  onCambiarVista,
  onCerrarTurno,
  searchQuery,
  onSearchChange,
  stockBajo,
  children,
}: ShellProps) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const isAdmin = esAdministrador(empleado.Puesto);
  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    if (!alertsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAlertsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [alertsOpen]);

  return (
    <div className="app-shell">
      <div className="app-ambient-glow" aria-hidden="true" />

      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="sidebar-brand" title="Alcohontrol · Expendio Pacífico">
          AC
        </div>

        <nav className="sidebar-rail">
          {visibleNav.map((item) => {
            const IconComponent = item.icon;
            const active = item.id === vistaActiva;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-icon-btn ${active ? 'is-active' : ''}`}
                onClick={() => onCambiarVista(item.id)}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <IconComponent size={20} weight={active ? 'bold' : 'regular'} />
              </button>
            );
          })}
        </nav>
      </aside>

      <header className="app-topbar">
        <div className="topbar-search">
          <MagnifyingGlass size={16} />
          <input
            type="search"
            className="input"
            placeholder="Buscar producto, venta o zona…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscador contextual"
          />
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="btn-circle"
            onClick={onCerrarTurno}
            title="Cambiar de empleado / Cerrar turno"
            aria-label="Cambiar de empleado"
          >
            <SignOut size={17} />
          </button>

          <div className="alerts-wrapper">
            <button
              type="button"
              className="btn-circle"
              onClick={() => setAlertsOpen((prev) => !prev)}
              aria-label="Alertas de stock bajo"
              title="Productos con stock bajo (≤ 30)"
            >
              <Bell size={17} />
              {stockBajo.length > 0 && <span className="alerts-dot" />}
            </button>

            {alertsOpen && (
              <>
                <div
                  className="alerts-backdrop"
                  onClick={() => setAlertsOpen(false)}
                  aria-hidden="true"
                />
                <div className="alerts-popover" role="dialog" aria-label="Alertas de stock mínimo">
                <div
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Stock bajo (≤ 30)</span>
                  <span className="badge badge-warn num-tabular">{stockBajo.length}</span>
                </div>

                {stockBajo.length === 0 ? (
                  <div style={{ padding: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Todo el inventario está por encima del mínimo.
                  </div>
                ) : (
                  <div>
                    {stockBajo.map((item) => (
                      <div
                        key={item.IdProducto}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.Producto}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.Categoria}</div>
                        </div>
                        <span
                          className={`badge num-tabular ${
                            item.Existencias === 0 ? 'badge-danger' : 'badge-warn'
                          }`}
                        >
                          {item.Existencias} uds
                        </span>
                      </div>
                    ))}
                    <div style={{ padding: 10 }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ width: '100%' }}
                        onClick={() => {
                          setAlertsOpen(false);
                          onCambiarVista('inventario');
                        }}
                      >
                        Ir a Inventario
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </>
            )}
          </div>

          <div className="topbar-user">
            <div className="topbar-avatar">{getInitials(empleado.Nombre)}</div>
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{empleado.Nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{empleado.Puesto}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}

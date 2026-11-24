import { useState, type ReactNode } from 'react';
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
  subtitle: string;
  icon: Icon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Resumen', subtitle: 'Estado general del expendio', icon: SquaresFour },
  { id: 'pos', label: 'Punto de Venta', subtitle: 'Registro de bajas y cobro en caja', icon: ShoppingCart },
  { id: 'croquis', label: 'Croquis', subtitle: 'Mapa de zonas y stock en vivo', icon: MapTrifold },
  { id: 'inventario', label: 'Inventario', subtitle: 'Productos, categorías y proveedores', icon: Package },
  { id: 'cortes', label: 'Cortes y Reportes', subtitle: 'Cortes diarios, semanales y mensuales', icon: ChartBar },
  { id: 'empleados', label: 'Personal', subtitle: 'Administración de empleados', icon: Users, adminOnly: true },
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
  const currentMeta = visibleNav.find((item) => item.id === vistaActiva) ?? visibleNav[0];

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="sidebar-brand" title="Alcohontrol">
          AC
        </div>

        <nav className="sidebar-nav">
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
                <IconComponent size={20} weight={active ? 'duotone' : 'regular'} />
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          className="nav-icon-btn"
          onClick={onCerrarTurno}
          title="Cambiar de empleado / Cerrar turno"
          aria-label="Cambiar de empleado"
        >
          <SignOut size={18} />
        </button>
      </aside>

      <header className="app-topbar">
        <div className="topbar-title-group">
          <h1 className="topbar-title">{currentMeta.label}</h1>
          <span className="topbar-subtitle">{currentMeta.subtitle}</span>
        </div>

        <div className="topbar-actions">
          <div className="topbar-search">
            <MagnifyingGlass size={14} />
            <input
              type="search"
              className="input"
              placeholder="Buscar producto, venta o zona…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Buscador contextual"
            />
          </div>

          <div className="alerts-wrapper">
            <button
              type="button"
              className="btn"
              style={{ width: 36, padding: 0, position: 'relative' }}
              onClick={() => setAlertsOpen((prev) => !prev)}
              aria-label="Alertas de stock bajo"
              title="Productos con stock bajo (<= 30)"
            >
              <Bell size={16} />
              {stockBajo.length > 0 && <span className="alerts-badge num-tabular">{stockBajo.length}</span>}
            </button>

            {alertsOpen && (
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
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 12,
              borderLeft: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{empleado.Nombre}</div>
              <div style={{ fontSize: 11, color: isAdmin ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                {empleado.Puesto}
              </div>
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '0 10px' }} onClick={onCerrarTurno}>
              Cambiar
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}

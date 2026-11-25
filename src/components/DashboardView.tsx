import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { InventoryValueCard } from './dashboard/InventoryValueCard.tsx';
import { SalesTrendChart } from './dashboard/SalesTrendChart.tsx';
import { StockHealthAside } from './dashboard/StockHealthAside.tsx';
import { ErrorCard } from './ui/ErrorCard.tsx';
import { api } from '../services/api.ts';
import type { ProductoStockBajo, ReporteProducto, VentaResumen, VistaId } from '../types/alcohontrol.ts';
import { formatCurrency, formatDateShort, getTodayIso } from '../utils/format.ts';

interface DashboardViewProps {
  searchQuery: string;
  onNavigate: (vista: VistaId) => void;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function DashboardView({ searchQuery, onNavigate }: DashboardViewProps) {
  const [productos, setProductos] = useState<ReporteProducto[]>([]);
  const [stockBajo, setStockBajo] = useState<ProductoStockBajo[]>([]);
  const [ventas, setVentas] = useState<VentaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayIso] = useState(() => getTodayIso());

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, bajos, ventasList] = await Promise.all([
        api.reportes.productos(),
        api.reportes.stockBajo(),
        api.ventas.listar(),
      ]);
      setProductos(prods);
      setStockBajo(bajos);
      setVentas(ventasList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el resumen operativo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.reportes.productos(), api.reportes.stockBajo(), api.ventas.listar()])
      .then(([prods, bajos, ventasList]) => {
        if (!cancelled) {
          setProductos(prods);
          setStockBajo(bajos);
          setVentas(ventasList);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar el resumen operativo.');
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

  const filteredVentas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? ventas.filter(
          (v) =>
            v.Empleado.toLowerCase().includes(q) ||
            String(v.IdVenta).includes(q) ||
            String(v.FechaVenta).includes(q),
        )
      : ventas;
    return list.slice(0, 5);
  }, [ventas, searchQuery]);

  const filteredStockBajo = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? stockBajo.filter(
          (p) => p.Producto.toLowerCase().includes(q) || p.Categoria.toLowerCase().includes(q),
        )
      : stockBajo;
    return list.slice(0, 6);
  }, [stockBajo, searchQuery]);

  if (error) {
    return <ErrorCard message={error} onRetry={() => void cargarDatos()} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Resumen Operativo</h1>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '999px',
              background: 'var(--status-ok)',
              boxShadow: '0 0 6px var(--status-ok)',
            }}
          />
          En línea
        </span>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-left">
          <SalesTrendChart ventas={ventas} todayIso={todayIso} loading={loading} />

          <div className="dashboard-bottom-row">
            <motion.section
              className="surface-card"
              style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.08, ease: EASE_OUT }}
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
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Últimas Ventas</h2>
                <button
                  type="button"
                  className="btn btn-pill"
                  style={{ height: 30, fontSize: 12 }}
                  onClick={() => onNavigate('cortes')}
                >
                  Ver cortes
                </button>
              </div>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="skeleton" style={{ width: '100%', height: 36 }} />
                  ))}
                </div>
              ) : filteredVentas.length === 0 ? (
                <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No hay ventas registradas para mostrar.
                </div>
              ) : (
                <div className="scroll-area" style={{ flex: 1 }}>
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th>Piezas</th>
                        <th>Monto</th>
                        <th style={{ textAlign: 'right' }}>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVentas.map((v, idx) => (
                        <tr
                          key={v.IdVenta}
                          className="stagger-row"
                          style={{ animationDelay: `${100 + idx * 45}ms` }}
                        >
                          <td style={{ fontWeight: 500 }}>{v.Empleado}</td>
                          <td>
                            <span className="badge badge-neutral num-tabular">{v.TotalArticulosVendidos} uds</span>
                          </td>
                          <td className="num-tabular" style={{ fontWeight: 500 }}>
                            {formatCurrency(v.TotalVenta)}
                          </td>
                          <td className="num-tabular" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatDateShort(v.FechaVenta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.section>

            <InventoryValueCard productos={productos} stockBajoCount={stockBajo.length} loading={loading} />
          </div>
        </div>

        <StockHealthAside
          productos={productos}
          stockBajo={filteredStockBajo}
          totalAlertas={stockBajo.length}
          loading={loading}
          onNavigateInventario={() => onNavigate('inventario')}
        />
      </div>
    </div>
  );
}

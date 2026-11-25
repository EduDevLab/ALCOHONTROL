import { useEffect, useState } from 'react';
import { DownloadSimple, Eye, Printer, X } from '@phosphor-icons/react';
import { api } from '../services/api.ts';
import type { CorteVentas, DetalleVentaItem, TipoCorte } from '../types/alcohontrol.ts';
import { formatCurrency, formatDateShort, getTodayIso } from '../utils/format.ts';

export function CortesView() {
  const [tipo, setTipo] = useState<TipoCorte>('diario');
  const [fecha, setFecha] = useState<string>(() => getTodayIso());
  const [corte, setCorte] = useState<CorteVentas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detalleModal, setDetalleModal] = useState<{ idVenta: number; items: DetalleVentaItem[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.reportes
      .corte({ tipo, fecha })
      .then((data) => {
        if (!cancelled) {
          setCorte(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al generar el corte.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tipo, fecha]);

  const abrirDetalle = async (idVenta: number) => {
    try {
      const items = await api.ventas.detalle(idVenta);
      setDetalleModal({ idVenta, items });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle de la venta.');
    }
  };

  const exportarCsv = () => {
    if (!corte) return;
    const rows = [
      ['Folio', 'Fecha', 'Empleado', 'Articulos', 'Total'],
      ...corte.ventas.map((v) => [
        String(v.IdVenta),
        String(v.FechaVenta).slice(0, 10),
        `"${v.Empleado.replace(/"/g, '""')}"`,
        String(v.TotalArticulosVendidos),
        String(v.TotalVenta),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corte-${corte.tipo}-${corte.desde}-a-${corte.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="view-header">
        <h1 className="view-title">Cortes de Ventas y Reportes</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {(['diario', 'semanal', 'mensual'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`btn btn-pill ${tipo === t ? 'btn-gold' : ''}`}
              style={{ height: 34, fontSize: 12, textTransform: 'capitalize' }}
              onClick={() => setTipo(t)}
            >
              {t}
            </button>
          ))}
          <input
            type="date"
            className="input num-tabular"
            style={{ width: 155, height: 34, borderRadius: 'var(--radius-pill)' }}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <button type="button" className="btn btn-pill" style={{ height: 34 }} onClick={exportarCsv} disabled={!corte}>
            <DownloadSimple size={14} />
            CSV
          </button>
          <button type="button" className="btn btn-pill" style={{ height: 34 }} onClick={() => window.print()}>
            <Printer size={14} />
            Imprimir
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0 }}>
          <section className="surface-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="skeleton" style={{ width: '100%', height: 48 }} />
            ))}
          </section>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 58%) minmax(0, 42%)', gap: 20, flex: 1 }}>
            <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="skeleton" style={{ width: '100%', height: 38 }} />
              ))}
            </section>
            <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="skeleton" style={{ width: '100%', height: 38 }} />
              ))}
            </section>
          </div>
        </div>
      ) : error ? (
        <div className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span className="badge badge-danger">Error</span>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      ) : (
        corte && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0 }}>
            {/* Métricas en línea */}
            <section
              className="surface-card"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Periodo</div>
                <div className="num-tabular" style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                  {formatDateShort(corte.desde)} — {formatDateShort(corte.hasta)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ventas Totales</div>
                <div className="num-tabular" style={{ fontSize: 26, fontWeight: 600 }}>
                  {corte.resumen.totalVentas}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Artículos Vendidos</div>
                <div className="num-tabular" style={{ fontSize: 26, fontWeight: 600 }}>
                  {corte.resumen.totalArticulos}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ingreso Total</div>
                <div className="num-tabular" style={{ fontSize: 26, fontWeight: 600, color: 'var(--accent-gold)' }}>
                  {formatCurrency(corte.resumen.ingresoTotal)}
                </div>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 58%) minmax(0, 42%)', gap: 20, flex: 1, minHeight: 0 }}>
              <section className="surface-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 500, flexShrink: 0 }}>Historial de Ventas del Corte</h2>
                {corte.ventas.length === 0 ? (
                  <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    No hubo ventas registradas en este periodo.
                  </div>
                ) : (
                  <div className="scroll-area" style={{ flex: 1 }}>
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Empleado</th>
                        <th>Piezas</th>
                        <th>Total</th>
                        <th>Fecha</th>
                        <th style={{ textAlign: 'right' }}>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corte.ventas.map((v) => (
                        <tr key={v.IdVenta}>
                          <td className="num-tabular">#{v.IdVenta}</td>
                          <td style={{ fontWeight: 500 }}>{v.Empleado}</td>
                          <td className="num-tabular">{v.TotalArticulosVendidos}</td>
                          <td className="num-tabular" style={{ fontWeight: 600 }}>
                            {formatCurrency(v.TotalVenta)}
                          </td>
                          <td className="num-tabular" style={{ color: 'var(--text-muted)' }}>
                            {formatDateShort(v.FechaVenta)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-circle"
                              style={{ width: 28, height: 28 }}
                              onClick={() => void abrirDetalle(v.IdVenta)}
                              title="Ver ticket"
                            >
                              <Eye size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </section>

              <section className="surface-card">
                <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 500 }}>Desglose por Empleado</h2>
                {corte.porEmpleado.length === 0 ? (
                  <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    Sin actividad en este periodo.
                  </div>
                ) : (
                  <table className="clean-table">
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th>Ventas</th>
                        <th style={{ textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corte.porEmpleado.map((e) => (
                        <tr key={e.IdEmpleado}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{e.Empleado}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.Puesto}</div>
                          </td>
                          <td className="num-tabular">{e.TotalVentas}</td>
                          <td className="num-tabular" style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(e.MontoTotalVendido)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          </div>
        )
      )}

      {detalleModal && (
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
          <div className="surface-card" style={{ width: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Detalle Venta #{detalleModal.idVenta}</h2>
              <button type="button" className="btn-circle" style={{ width: 30, height: 30 }} onClick={() => setDetalleModal(null)}>
                <X size={14} />
              </button>
            </div>
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Precio</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalleModal.items.map((item) => (
                  <tr key={item.IdDetalle}>
                    <td style={{ fontWeight: 500 }}>{item.Producto}</td>
                    <td className="num-tabular">{item.Cantidad}</td>
                    <td className="num-tabular">{formatCurrency(item.PrecioUnitario)}</td>
                    <td className="num-tabular" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(item.Subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

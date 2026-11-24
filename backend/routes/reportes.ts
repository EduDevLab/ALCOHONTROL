import { Router } from 'express';
import { getPool, sql } from '../db.ts';
import { handleSqlError, isValidIsoDate } from '../utils/http.ts';

export const reportesRouter = Router();

type TipoCorte = 'diario' | 'semanal' | 'mensual';

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeCorteRange(tipo: TipoCorte, fechaIso: string): { desde: string; hasta: string } {
  const [year, month, day] = fechaIso.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));

  if (tipo === 'diario') {
    return { desde: fechaIso, hasta: fechaIso };
  }

  if (tipo === 'semanal') {
    // Semana lunes a domingo que contiene `fechaIso`
    const dow = base.getUTCDay(); // 0 = domingo, 1 = lunes ...
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(base);
    monday.setUTCDate(base.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      desde: monday.toISOString().slice(0, 10),
      hasta: sunday.toISOString().slice(0, 10),
    };
  }

  // Mensual: primer y último día del mes
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  return {
    desde: firstDay.toISOString().slice(0, 10),
    hasta: lastDay.toISOString().slice(0, 10),
  };
}

reportesRouter.get('/reportes/productos', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT IdProducto, Producto, Categoria, Proveedor, Precio, Existencias, ValorTotalInventario
      FROM dbo.Vista_Reporte_Productos
      ORDER BY IdProducto ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar el reporte de productos.');
  }
});

reportesRouter.get('/reportes/stock-bajo', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT IdProducto, Producto, Categoria, Proveedor, TelefonoProveedor, Precio, Existencias
      FROM dbo.Vista_Productos_StockBajo
      ORDER BY Existencias ASC, IdProducto ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar productos con stock bajo.');
  }
});

reportesRouter.get('/reportes/empleados', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT IdEmpleado, Empleado, Puesto, TotalVentas, TotalArticulosVendidos, MontoTotalVendido
      FROM dbo.Vista_Ventas_Por_Empleado
      ORDER BY MontoTotalVendido DESC, IdEmpleado ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar ventas por empleado.');
  }
});

reportesRouter.get('/reportes/corte', async (req, res) => {
  const tipoRaw = (req.query.tipo as string | undefined) ?? 'diario';
  if (tipoRaw !== 'diario' && tipoRaw !== 'semanal' && tipoRaw !== 'mensual') {
    res.status(400).json({ error: 'El parámetro "tipo" debe ser diario, semanal o mensual.' });
    return;
  }

  const fechaParam = req.query.fecha as string | undefined;
  if (fechaParam !== undefined && !isValidIsoDate(fechaParam)) {
    res.status(400).json({ error: 'El parámetro "fecha" debe tener formato YYYY-MM-DD.' });
    return;
  }

  const desdeOverride = req.query.desde as string | undefined;
  const hastaOverride = req.query.hasta as string | undefined;
  if (desdeOverride !== undefined && !isValidIsoDate(desdeOverride)) {
    res.status(400).json({ error: 'El parámetro "desde" debe tener formato YYYY-MM-DD.' });
    return;
  }
  if (hastaOverride !== undefined && !isValidIsoDate(hastaOverride)) {
    res.status(400).json({ error: 'El parámetro "hasta" debe tener formato YYYY-MM-DD.' });
    return;
  }

  const fechaBase = fechaParam ?? getTodayIso();
  const computed = computeCorteRange(tipoRaw, fechaBase);
  const desde = desdeOverride ?? computed.desde;
  const hasta = hastaOverride ?? computed.hasta;

  try {
    const pool = await getPool();

    const ventasRes = await pool
      .request()
      .input('Desde', sql.Date, desde)
      .input('Hasta', sql.Date, hasta)
      .query(`
        SELECT IdVenta, FechaVenta, Empleado, TotalArticulosVendidos, TotalVenta
        FROM dbo.Vista_Reporte_Ventas
        WHERE FechaVenta >= @Desde AND FechaVenta <= @Hasta
        ORDER BY FechaVenta DESC, IdVenta DESC
      `);

    const empleadosRes = await pool
      .request()
      .input('Desde', sql.Date, desde)
      .input('Hasta', sql.Date, hasta)
      .query(`
        SELECT
          E.IdEmpleado,
          E.Nombre AS Empleado,
          E.Puesto,
          COUNT(DISTINCT V.IdVenta) AS TotalVentas,
          ISNULL(SUM(DV.Cantidad), 0) AS TotalArticulosVendidos,
          ISNULL(SUM(DV.Cantidad * DV.PrecioUnitario), 0) AS MontoTotalVendido
        FROM dbo.Ventas V
        INNER JOIN dbo.Empleados E ON V.IdEmpleado = E.IdEmpleado
        LEFT JOIN dbo.DetalleVenta DV ON V.IdVenta = DV.IdVenta
        WHERE V.FechaVenta >= @Desde AND V.FechaVenta <= @Hasta
        GROUP BY E.IdEmpleado, E.Nombre, E.Puesto
        ORDER BY MontoTotalVendido DESC
      `);

    const categoriasRes = await pool
      .request()
      .input('Desde', sql.Date, desde)
      .input('Hasta', sql.Date, hasta)
      .query(`
        SELECT
          C.IdCategorias,
          C.Nombre AS Categoria,
          ISNULL(SUM(DV.Cantidad), 0) AS TotalArticulosVendidos,
          ISNULL(SUM(DV.Cantidad * DV.PrecioUnitario), 0) AS MontoTotalVendido
        FROM dbo.Ventas V
        INNER JOIN dbo.DetalleVenta DV ON V.IdVenta = DV.IdVenta
        INNER JOIN dbo.Productos P ON DV.IdProducto = P.IdProducto
        INNER JOIN dbo.Categorias C ON P.IdCategorias = C.IdCategorias
        WHERE V.FechaVenta >= @Desde AND V.FechaVenta <= @Hasta
        GROUP BY C.IdCategorias, C.Nombre
        ORDER BY MontoTotalVendido DESC
      `);

    const ventas = ventasRes.recordset;
    const totalVentas = ventas.length;
    const totalArticulos = ventas.reduce((acc, v) => acc + Number(v.TotalArticulosVendidos || 0), 0);
    const ingresoTotal = ventas.reduce((acc, v) => acc + Number(v.TotalVenta || 0), 0);
    const ticketPromedio = totalVentas > 0 ? Number((ingresoTotal / totalVentas).toFixed(2)) : 0;

    res.json({
      tipo: tipoRaw,
      desde,
      hasta,
      resumen: {
        totalVentas,
        totalArticulos,
        ingresoTotal: Number(ingresoTotal.toFixed(2)),
        ticketPromedio,
      },
      porEmpleado: empleadosRes.recordset,
      porCategoria: categoriasRes.recordset,
      ventas,
    });
  } catch (err) {
    handleSqlError(res, err, 'Error al generar el corte de ventas.');
  }
});

import { Router } from 'express';
import { getPool, sql } from '../db.ts';
import { handleSqlError, isValidIsoDate, parsePositiveInt } from '../utils/http.ts';

export const ventasRouter = Router();

interface VentaItemInput {
  IdProducto: number;
  Cantidad: number;
  PrecioUnitario?: number;
}

ventasRouter.get('/ventas', async (req, res) => {
  const { desde, hasta, idEmpleado } = req.query;

  if (desde !== undefined && !isValidIsoDate(desde)) {
    res.status(400).json({ error: 'El parámetro "desde" debe tener formato YYYY-MM-DD.' });
    return;
  }
  if (hasta !== undefined && !isValidIsoDate(hasta)) {
    res.status(400).json({ error: 'El parámetro "hasta" debe tener formato YYYY-MM-DD.' });
    return;
  }

  const empId = idEmpleado !== undefined ? parsePositiveInt(idEmpleado) : null;
  if (idEmpleado !== undefined && !empId) {
    res.status(400).json({ error: 'El parámetro "idEmpleado" debe ser un entero positivo.' });
    return;
  }

  try {
    const pool = await getPool();
    const request = pool.request();
    const filters: string[] = [];

    if (desde) {
      request.input('Desde', sql.Date, desde);
      filters.push('VR.FechaVenta >= @Desde');
    }
    if (hasta) {
      request.input('Hasta', sql.Date, hasta);
      filters.push('VR.FechaVenta <= @Hasta');
    }
    if (empId) {
      request.input('IdEmpleado', sql.Int, empId);
      filters.push('V.IdEmpleado = @IdEmpleado');
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `
      SELECT
        VR.IdVenta,
        VR.FechaVenta,
        V.IdEmpleado,
        VR.Empleado,
        VR.TotalArticulosVendidos,
        VR.TotalVenta
      FROM dbo.Vista_Reporte_Ventas VR
      INNER JOIN dbo.Ventas V ON VR.IdVenta = V.IdVenta
      ${whereClause}
      ORDER BY VR.FechaVenta DESC, VR.IdVenta DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar el historial de ventas.');
  }
});

ventasRouter.get('/ventas/:id/detalle', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdVenta inválido.' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('IdVenta', sql.Int, id)
      .query(`
        SELECT IdDetalle, IdVenta, FechaVenta, Producto, Cantidad, PrecioUnitario, Subtotal
        FROM dbo.Vista_Reporte_DetalleVenta
        WHERE IdVenta = @IdVenta
        ORDER BY IdDetalle ASC
      `);
    res.json(result.recordset);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar el detalle de la venta.');
  }
});

ventasRouter.post('/ventas', async (req, res) => {
  const { IdEmpleado, FechaVenta, items } = req.body ?? {};
  const empId = parsePositiveInt(IdEmpleado);

  if (!empId) {
    res.status(400).json({ error: 'IdEmpleado debe ser un entero positivo.' });
    return;
  }
  if (FechaVenta !== undefined && !isValidIsoDate(FechaVenta)) {
    res.status(400).json({ error: 'FechaVenta debe tener formato YYYY-MM-DD.' });
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'La venta debe incluir al menos un producto en "items".' });
    return;
  }

  const normalizedItems: VentaItemInput[] = [];
  for (const item of items) {
    const prodId = parsePositiveInt(item?.IdProducto);
    const cant = parsePositiveInt(item?.Cantidad);
    const precio = item?.PrecioUnitario !== undefined ? Number(item.PrecioUnitario) : undefined;

    if (!prodId || !cant) {
      res.status(400).json({ error: 'Cada partida debe tener IdProducto y Cantidad enteros positivos.' });
      return;
    }
    if (precio !== undefined && (!Number.isFinite(precio) || precio <= 0)) {
      res.status(400).json({ error: 'PrecioUnitario debe ser mayor a 0.' });
      return;
    }
    normalizedItems.push({ IdProducto: prodId, Cantidad: cant, PrecioUnitario: precio });
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const ventaRes = await new sql.Request(transaction)
      .input('Accion', sql.Int, 1)
      .input('IdVenta', sql.Int, null)
      .input('FechaVenta', sql.Date, FechaVenta ?? null)
      .input('IdEmpleado', sql.Int, empId)
      .execute('dbo.PA_CRUD_Ventas');

    const idVenta = ventaRes.recordset[0]?.IdVenta as number | undefined;
    if (!idVenta) {
      throw new Error('No se pudo obtener el IdVenta generado.');
    }

    for (const item of normalizedItems) {
      await new sql.Request(transaction)
        .input('Accion', sql.Int, 1)
        .input('IdDetalle', sql.Int, null)
        .input('IdVenta', sql.Int, idVenta)
        .input('IdProducto', sql.Int, item.IdProducto)
        .input('Cantidad', sql.Int, item.Cantidad)
        .input('PrecioUnitario', sql.Decimal(10, 2), item.PrecioUnitario ?? null)
        .execute('dbo.PA_CRUD_DetalleVenta');
    }

    await transaction.commit();

    const summary = await pool
      .request()
      .input('IdVenta', sql.Int, idVenta)
      .query(`
        SELECT IdVenta, FechaVenta, Empleado, TotalArticulosVendidos, TotalVenta
        FROM dbo.Vista_Reporte_Ventas
        WHERE IdVenta = @IdVenta
      `);

    res.status(201).json({
      mensaje: 'Venta registrada correctamente.',
      venta: summary.recordset[0] ?? { IdVenta: idVenta, IdEmpleado: empId },
    });
  } catch (err) {
    // El trigger TR_DetalleVenta_Insert_DescontarStock puede haber hecho ROLLBACK previo;
    // intentamos rollback defensivo sin enmascarar el error original (ej. 50001).
    try {
      await transaction.rollback();
    } catch {
      // Transacción ya abortada por SQL Server.
    }
    handleSqlError(res, err, 'Error al registrar la venta.');
  }
});

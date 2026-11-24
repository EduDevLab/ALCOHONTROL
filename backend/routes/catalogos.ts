import { Router } from 'express';
import { getPool, sql } from '../db.ts';
import { handleSqlError, parsePositiveInt } from '../utils/http.ts';

export const catalogosRouter = Router();

const PHONE_REGEX = /^\d{10}$/;

// ============================================================================
// PRODUCTOS
// ============================================================================

catalogosRouter.get('/productos', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdProducto', sql.Int, null)
      .execute('dbo.PA_CRUD_Productos');
    res.json(result.recordset);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar productos.');
  }
});

catalogosRouter.get('/productos/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdProducto inválido.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdProducto', sql.Int, id)
      .execute('dbo.PA_CRUD_Productos');
    if (result.recordset.length === 0) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar el producto.');
  }
});

catalogosRouter.post('/productos', async (req, res) => {
  const { Nombre, IdCategorias, Precio, Existencias = 0, IdProveedor } = req.body ?? {};
  const catId = parsePositiveInt(IdCategorias);
  const provId = parsePositiveInt(IdProveedor);
  const precioNum = Number(Precio);
  const existenciasNum = Number(Existencias);

  if (typeof Nombre !== 'string' || !Nombre.trim()) {
    res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
    return;
  }
  if (!catId || !provId) {
    res.status(400).json({ error: 'IdCategorias e IdProveedor deben ser enteros positivos.' });
    return;
  }
  if (!Number.isFinite(precioNum) || precioNum <= 0) {
    res.status(400).json({ error: 'El precio debe ser mayor a 0.' });
    return;
  }
  if (!Number.isInteger(existenciasNum) || existenciasNum < 0) {
    res.status(400).json({ error: 'Las existencias deben ser un entero mayor o igual a 0.' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 1)
      .input('IdProducto', sql.Int, null)
      .input('Nombre', sql.VarChar(30), Nombre.trim())
      .input('IdCategorias', sql.Int, catId)
      .input('Precio', sql.Decimal(10, 2), precioNum)
      .input('Existencias', sql.Int, existenciasNum)
      .input('IdProveedor', sql.Int, provId)
      .execute('dbo.PA_CRUD_Productos');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al crear el producto.');
  }
});

catalogosRouter.put('/productos/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdProducto inválido.' });
    return;
  }

  const { Nombre, IdCategorias, Precio, Existencias, IdProveedor } = req.body ?? {};
  const precioNum = Precio !== undefined ? Number(Precio) : null;
  const existenciasNum = Existencias !== undefined ? Number(Existencias) : null;

  if (precioNum !== null && (!Number.isFinite(precioNum) || precioNum <= 0)) {
    res.status(400).json({ error: 'El precio debe ser mayor a 0.' });
    return;
  }
  if (existenciasNum !== null && (!Number.isInteger(existenciasNum) || existenciasNum < 0)) {
    res.status(400).json({ error: 'Las existencias deben ser un entero mayor o igual a 0.' });
    return;
  }

  try {
    const pool = await getPool();
    const existing = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdProducto', sql.Int, id)
      .execute('dbo.PA_CRUD_Productos');
    if (existing.recordset.length === 0) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }

    const result = await pool
      .request()
      .input('Accion', sql.Int, 1)
      .input('IdProducto', sql.Int, id)
      .input('Nombre', sql.VarChar(30), typeof Nombre === 'string' && Nombre.trim() ? Nombre.trim() : null)
      .input('IdCategorias', sql.Int, IdCategorias !== undefined ? parsePositiveInt(IdCategorias) : null)
      .input('Precio', sql.Decimal(10, 2), precioNum)
      .input('Existencias', sql.Int, existenciasNum)
      .input('IdProveedor', sql.Int, IdProveedor !== undefined ? parsePositiveInt(IdProveedor) : null)
      .execute('dbo.PA_CRUD_Productos');
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al actualizar el producto.');
  }
});

catalogosRouter.patch('/productos/:id/existencias', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdProducto inválido.' });
    return;
  }

  const { delta, Existencias } = req.body ?? {};
  if (delta === undefined && Existencias === undefined) {
    res.status(400).json({ error: 'Debe enviar "delta" o "Existencias".' });
    return;
  }

  try {
    const pool = await getPool();
    const existing = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdProducto', sql.Int, id)
      .execute('dbo.PA_CRUD_Productos');

    if (existing.recordset.length === 0) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }

    const currentStock = Number(existing.recordset[0].Existencias);
    const nextStock =
      Existencias !== undefined ? Number(Existencias) : currentStock + Number(delta);

    if (!Number.isInteger(nextStock) || nextStock < 0) {
      res.status(400).json({ error: 'Las existencias resultantes deben ser un entero mayor o igual a 0.' });
      return;
    }

    await pool
      .request()
      .input('Accion', sql.Int, 1)
      .input('IdProducto', sql.Int, id)
      .input('Existencias', sql.Int, nextStock)
      .execute('dbo.PA_CRUD_Productos');

    res.json({
      IdProducto: id,
      ExistenciasAnteriores: currentStock,
      Existencias: nextStock,
    });
  } catch (err) {
    handleSqlError(res, err, 'Error al ajustar las existencias del producto.');
  }
});

catalogosRouter.delete('/productos/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdProducto inválido.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 3)
      .input('IdProducto', sql.Int, id)
      .execute('dbo.PA_CRUD_Productos');
    if ((result.recordset[0]?.FilasEliminadas ?? 0) === 0) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al eliminar el producto.');
  }
});

// ============================================================================
// CATEGORÍAS
// ============================================================================

catalogosRouter.get('/categorias', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdCategorias', sql.Int, null)
      .execute('dbo.PA_CRUD_Categorias');
    res.json(result.recordset);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar categorías.');
  }
});

catalogosRouter.get('/categorias/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdCategorias inválido.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdCategorias', sql.Int, id)
      .execute('dbo.PA_CRUD_Categorias');
    if (result.recordset.length === 0) {
      res.status(404).json({ error: 'Categoría no encontrada.' });
      return;
    }
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar la categoría.');
  }
});

catalogosRouter.post('/categorias', async (req, res) => {
  const { Nombre } = req.body ?? {};
  if (typeof Nombre !== 'string' || !Nombre.trim()) {
    res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 1)
      .input('IdCategorias', sql.Int, null)
      .input('Nombre', sql.VarChar(50), Nombre.trim())
      .execute('dbo.PA_CRUD_Categorias');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al crear la categoría.');
  }
});

catalogosRouter.put('/categorias/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdCategorias inválido.' });
    return;
  }
  const { Nombre } = req.body ?? {};
  if (typeof Nombre !== 'string' || !Nombre.trim()) {
    res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    return;
  }
  try {
    const pool = await getPool();
    const existing = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdCategorias', sql.Int, id)
      .execute('dbo.PA_CRUD_Categorias');
    if (existing.recordset.length === 0) {
      res.status(404).json({ error: 'Categoría no encontrada.' });
      return;
    }

    const result = await pool
      .request()
      .input('Accion', sql.Int, 1)
      .input('IdCategorias', sql.Int, id)
      .input('Nombre', sql.VarChar(50), Nombre.trim())
      .execute('dbo.PA_CRUD_Categorias');
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al actualizar la categoría.');
  }
});

catalogosRouter.delete('/categorias/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdCategorias inválido.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 3)
      .input('IdCategorias', sql.Int, id)
      .execute('dbo.PA_CRUD_Categorias');
    if ((result.recordset[0]?.FilasEliminadas ?? 0) === 0) {
      res.status(404).json({ error: 'Categoría no encontrada.' });
      return;
    }
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al eliminar la categoría.');
  }
});

// ============================================================================
// PROVEEDORES
// ============================================================================

catalogosRouter.get('/proveedores', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdProveedor', sql.Int, null)
      .execute('dbo.PA_CRUD_Proveedores');
    res.json(result.recordset);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar proveedores.');
  }
});

catalogosRouter.get('/proveedores/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdProveedor inválido.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdProveedor', sql.Int, id)
      .execute('dbo.PA_CRUD_Proveedores');
    if (result.recordset.length === 0) {
      res.status(404).json({ error: 'Proveedor no encontrado.' });
      return;
    }
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar el proveedor.');
  }
});

catalogosRouter.post('/proveedores', async (req, res) => {
  const { Nombre, Telefono } = req.body ?? {};
  if (typeof Nombre !== 'string' || !Nombre.trim()) {
    res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
    return;
  }
  if (typeof Telefono !== 'string' || !PHONE_REGEX.test(Telefono.trim())) {
    res.status(400).json({ error: 'El teléfono debe contener exactamente 10 dígitos numéricos.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 1)
      .input('IdProveedor', sql.Int, null)
      .input('Nombre', sql.VarChar(30), Nombre.trim())
      .input('Telefono', sql.VarChar(15), Telefono.trim())
      .execute('dbo.PA_CRUD_Proveedores');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al crear el proveedor.');
  }
});

catalogosRouter.put('/proveedores/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdProveedor inválido.' });
    return;
  }
  const { Nombre, Telefono } = req.body ?? {};
  if (Telefono !== undefined && (typeof Telefono !== 'string' || !PHONE_REGEX.test(Telefono.trim()))) {
    res.status(400).json({ error: 'El teléfono debe contener exactamente 10 dígitos numéricos.' });
    return;
  }
  try {
    const pool = await getPool();
    const existing = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdProveedor', sql.Int, id)
      .execute('dbo.PA_CRUD_Proveedores');
    if (existing.recordset.length === 0) {
      res.status(404).json({ error: 'Proveedor no encontrado.' });
      return;
    }

    const result = await pool
      .request()
      .input('Accion', sql.Int, 1)
      .input('IdProveedor', sql.Int, id)
      .input('Nombre', sql.VarChar(30), typeof Nombre === 'string' && Nombre.trim() ? Nombre.trim() : null)
      .input('Telefono', sql.VarChar(15), typeof Telefono === 'string' ? Telefono.trim() : null)
      .execute('dbo.PA_CRUD_Proveedores');
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al actualizar el proveedor.');
  }
});

catalogosRouter.delete('/proveedores/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdProveedor inválido.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 3)
      .input('IdProveedor', sql.Int, id)
      .execute('dbo.PA_CRUD_Proveedores');
    if ((result.recordset[0]?.FilasEliminadas ?? 0) === 0) {
      res.status(404).json({ error: 'Proveedor no encontrado.' });
      return;
    }
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al eliminar el proveedor.');
  }
});

// ============================================================================
// EMPLEADOS
// ============================================================================

catalogosRouter.get('/empleados', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdEmpleado', sql.Int, null)
      .execute('dbo.PA_CRUD_Empleados');
    res.json(result.recordset);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar empleados.');
  }
});

catalogosRouter.get('/empleados/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdEmpleado inválido.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdEmpleado', sql.Int, id)
      .execute('dbo.PA_CRUD_Empleados');
    if (result.recordset.length === 0) {
      res.status(404).json({ error: 'Empleado no encontrado.' });
      return;
    }
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al consultar el empleado.');
  }
});

catalogosRouter.post('/empleados', async (req, res) => {
  const { Nombre, Puesto, Telefono } = req.body ?? {};
  if (typeof Nombre !== 'string' || !Nombre.trim()) {
    res.status(400).json({ error: 'El nombre del empleado es obligatorio.' });
    return;
  }
  if (typeof Puesto !== 'string' || !Puesto.trim()) {
    res.status(400).json({ error: 'El puesto del empleado es obligatorio.' });
    return;
  }
  if (typeof Telefono !== 'string' || !PHONE_REGEX.test(Telefono.trim())) {
    res.status(400).json({ error: 'El teléfono debe contener exactamente 10 dígitos numéricos.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 1)
      .input('IdEmpleado', sql.Int, null)
      .input('Nombre', sql.VarChar(100), Nombre.trim())
      .input('Puesto', sql.VarChar(30), Puesto.trim())
      .input('Telefono', sql.VarChar(15), Telefono.trim())
      .execute('dbo.PA_CRUD_Empleados');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al crear el empleado.');
  }
});

catalogosRouter.put('/empleados/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdEmpleado inválido.' });
    return;
  }
  const { Nombre, Puesto, Telefono } = req.body ?? {};
  if (Telefono !== undefined && (typeof Telefono !== 'string' || !PHONE_REGEX.test(Telefono.trim()))) {
    res.status(400).json({ error: 'El teléfono debe contener exactamente 10 dígitos numéricos.' });
    return;
  }
  try {
    const pool = await getPool();
    const existing = await pool
      .request()
      .input('Accion', sql.Int, 2)
      .input('IdEmpleado', sql.Int, id)
      .execute('dbo.PA_CRUD_Empleados');
    if (existing.recordset.length === 0) {
      res.status(404).json({ error: 'Empleado no encontrado.' });
      return;
    }

    const result = await pool
      .request()
      .input('Accion', sql.Int, 1)
      .input('IdEmpleado', sql.Int, id)
      .input('Nombre', sql.VarChar(100), typeof Nombre === 'string' && Nombre.trim() ? Nombre.trim() : null)
      .input('Puesto', sql.VarChar(30), typeof Puesto === 'string' && Puesto.trim() ? Puesto.trim() : null)
      .input('Telefono', sql.VarChar(15), typeof Telefono === 'string' ? Telefono.trim() : null)
      .execute('dbo.PA_CRUD_Empleados');
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al actualizar el empleado.');
  }
});

catalogosRouter.delete('/empleados/:id', async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'IdEmpleado inválido.' });
    return;
  }
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Accion', sql.Int, 3)
      .input('IdEmpleado', sql.Int, id)
      .execute('dbo.PA_CRUD_Empleados');
    if ((result.recordset[0]?.FilasEliminadas ?? 0) === 0) {
      res.status(404).json({ error: 'Empleado no encontrado.' });
      return;
    }
    res.json(result.recordset[0]);
  } catch (err) {
    handleSqlError(res, err, 'Error al eliminar el empleado.');
  }
});

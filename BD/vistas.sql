USE [alcohontrol]
GO

/****** Objeto: View [dbo].[Vista_Reporte_Productos] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER VIEW [dbo].[Vista_Reporte_Productos]
AS
SELECT
    P.IdProducto,
    P.Nombre AS Producto,
    C.Nombre AS Categoria,
    PR.Nombre AS Proveedor,
    P.Precio,
    P.Existencias,
    (P.Precio * P.Existencias) AS ValorTotalInventario
FROM dbo.Productos P
INNER JOIN dbo.Categorias C ON P.IdCategorias = C.IdCategorias
INNER JOIN dbo.Proveedores PR ON P.IdProveedor = PR.IdProveedor;
GO

/****** Objeto: View [dbo].[Vista_Reporte_Ventas] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER VIEW [dbo].[Vista_Reporte_Ventas]
AS
SELECT
    V.IdVenta,
    V.FechaVenta,
    E.Nombre AS Empleado,
    ISNULL(SUM(DV.Cantidad), 0) AS TotalArticulosVendidos,
    ISNULL(SUM(DV.Cantidad * DV.PrecioUnitario), 0) AS TotalVenta
FROM dbo.Ventas V
INNER JOIN dbo.Empleados E ON V.IdEmpleado = E.IdEmpleado
LEFT JOIN dbo.DetalleVenta DV ON V.IdVenta = DV.IdVenta
GROUP BY V.IdVenta, V.FechaVenta, E.Nombre;
GO

/****** Objeto: View [dbo].[Vista_Reporte_DetalleVenta] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER VIEW [dbo].[Vista_Reporte_DetalleVenta]
AS
SELECT
    DV.IdDetalle,
    DV.IdVenta,
    V.FechaVenta,
    P.Nombre AS Producto,
    DV.Cantidad,
    DV.PrecioUnitario,
    (DV.Cantidad * DV.PrecioUnitario) AS Subtotal
FROM dbo.DetalleVenta DV
INNER JOIN dbo.Ventas V ON DV.IdVenta = V.IdVenta
INNER JOIN dbo.Productos P ON DV.IdProducto = P.IdProducto;
GO

/****** Objeto: View [dbo].[Vista_Productos_StockBajo] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER VIEW [dbo].[Vista_Productos_StockBajo]
AS
SELECT
    P.IdProducto,
    P.Nombre AS Producto,
    C.Nombre AS Categoria,
    PR.Nombre AS Proveedor,
    PR.Telefono AS TelefonoProveedor,
    P.Precio,
    P.Existencias
FROM dbo.Productos P
INNER JOIN dbo.Categorias C ON P.IdCategorias = C.IdCategorias
INNER JOIN dbo.Proveedores PR ON P.IdProveedor = PR.IdProveedor
WHERE P.Existencias <= 30;
GO

/****** Objeto: View [dbo].[Vista_Ventas_Por_Empleado] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER VIEW [dbo].[Vista_Ventas_Por_Empleado]
AS
SELECT
    E.IdEmpleado,
    E.Nombre AS Empleado,
    E.Puesto,
    COUNT(DISTINCT V.IdVenta) AS TotalVentas,
    ISNULL(SUM(DV.Cantidad), 0) AS TotalArticulosVendidos,
    ISNULL(SUM(DV.Cantidad * DV.PrecioUnitario), 0) AS MontoTotalVendido
FROM dbo.Empleados E
LEFT JOIN dbo.Ventas V ON E.IdEmpleado = V.IdEmpleado
LEFT JOIN dbo.DetalleVenta DV ON V.IdVenta = DV.IdVenta
GROUP BY E.IdEmpleado, E.Nombre, E.Puesto;
GO

USE [alcohontrol]
GO

/*
================================================================================
Convención de @Accion (valores enteros empezando en 1) para todos los SPs:
  1 = Guardar (UPDATE si el registro existe por PK; INSERT si es nuevo o NULL/0)
  2 = Consultar (todos los registros si el ID es NULL; o filtrado por ID)
  3 = Eliminar (por PK)
================================================================================
*/

/****** Objeto: StoredProcedure [dbo].[PA_CRUD_Productos] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[PA_CRUD_Productos]
    @Accion INT,
    @IdProducto INT = NULL,
    @Nombre VARCHAR(30) = NULL,
    @IdCategorias INT = NULL,
    @Precio DECIMAL(10, 2) = NULL,
    @Existencias INT = NULL,
    @IdProveedor INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 1 = Guardar (INSERT o UPDATE automático según exista)
    IF @Accion = 1
    BEGIN
        IF @IdProducto IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Productos WHERE IdProducto = @IdProducto)
        BEGIN
            UPDATE dbo.Productos
            SET Nombre = ISNULL(@Nombre, Nombre),
                IdCategorias = ISNULL(@IdCategorias, IdCategorias),
                Precio = ISNULL(@Precio, Precio),
                Existencias = ISNULL(@Existencias, Existencias),
                IdProveedor = ISNULL(@IdProveedor, IdProveedor)
            WHERE IdProducto = @IdProducto;

            SELECT N'ACTUALIZADO' AS AccionRealizada, @IdProducto AS IdProducto;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Productos (Nombre, IdCategorias, Precio, Existencias, IdProveedor)
            VALUES (@Nombre, @IdCategorias, @Precio, ISNULL(@Existencias, 0), @IdProveedor);

            SELECT N'INSERTADO' AS AccionRealizada, CAST(SCOPE_IDENTITY() AS INT) AS IdProducto;
        END
    END
    -- 2 = Consultar
    ELSE IF @Accion = 2
    BEGIN
        SELECT IdProducto, Nombre, IdCategorias, Precio, Existencias, IdProveedor
        FROM dbo.Productos
        WHERE @IdProducto IS NULL OR IdProducto = @IdProducto
        ORDER BY IdProducto;
    END
    -- 3 = Eliminar
    ELSE IF @Accion = 3
    BEGIN
        DELETE FROM dbo.Productos
        WHERE IdProducto = @IdProducto;

        SELECT @@ROWCOUNT AS FilasEliminadas;
    END
    ELSE
    BEGIN
        ;THROW 50010, N'Acción no válida. Use: 1 = Guardar (Insert/Update), 2 = Consultar, 3 = Eliminar.', 1;
    END
END;
GO

/****** Objeto: StoredProcedure [dbo].[PA_CRUD_Categorias] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[PA_CRUD_Categorias]
    @Accion INT,
    @IdCategorias INT = NULL,
    @Nombre VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 1 = Guardar (INSERT o UPDATE automático según exista)
    IF @Accion = 1
    BEGIN
        IF @IdCategorias IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Categorias WHERE IdCategorias = @IdCategorias)
        BEGIN
            UPDATE dbo.Categorias
            SET Nombre = ISNULL(@Nombre, Nombre)
            WHERE IdCategorias = @IdCategorias;

            SELECT N'ACTUALIZADO' AS AccionRealizada, @IdCategorias AS IdCategorias;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Categorias (Nombre)
            VALUES (@Nombre);

            SELECT N'INSERTADO' AS AccionRealizada, CAST(SCOPE_IDENTITY() AS INT) AS IdCategorias;
        END
    END
    -- 2 = Consultar
    ELSE IF @Accion = 2
    BEGIN
        SELECT IdCategorias, Nombre
        FROM dbo.Categorias
        WHERE @IdCategorias IS NULL OR IdCategorias = @IdCategorias
        ORDER BY IdCategorias;
    END
    -- 3 = Eliminar
    ELSE IF @Accion = 3
    BEGIN
        DELETE FROM dbo.Categorias
        WHERE IdCategorias = @IdCategorias;

        SELECT @@ROWCOUNT AS FilasEliminadas;
    END
    ELSE
    BEGIN
        ;THROW 50010, N'Acción no válida. Use: 1 = Guardar (Insert/Update), 2 = Consultar, 3 = Eliminar.', 1;
    END
END;
GO

/****** Objeto: StoredProcedure [dbo].[PA_CRUD_Proveedores] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[PA_CRUD_Proveedores]
    @Accion INT,
    @IdProveedor INT = NULL,
    @Nombre VARCHAR(30) = NULL,
    @Telefono VARCHAR(15) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 1 = Guardar (INSERT o UPDATE automático según exista)
    IF @Accion = 1
    BEGIN
        IF @IdProveedor IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Proveedores WHERE IdProveedor = @IdProveedor)
        BEGIN
            UPDATE dbo.Proveedores
            SET Nombre = ISNULL(@Nombre, Nombre),
                Telefono = ISNULL(@Telefono, Telefono)
            WHERE IdProveedor = @IdProveedor;

            SELECT N'ACTUALIZADO' AS AccionRealizada, @IdProveedor AS IdProveedor;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Proveedores (Nombre, Telefono)
            VALUES (@Nombre, @Telefono);

            SELECT N'INSERTADO' AS AccionRealizada, CAST(SCOPE_IDENTITY() AS INT) AS IdProveedor;
        END
    END
    -- 2 = Consultar
    ELSE IF @Accion = 2
    BEGIN
        SELECT IdProveedor, Nombre, Telefono
        FROM dbo.Proveedores
        WHERE @IdProveedor IS NULL OR IdProveedor = @IdProveedor
        ORDER BY IdProveedor;
    END
    -- 3 = Eliminar
    ELSE IF @Accion = 3
    BEGIN
        DELETE FROM dbo.Proveedores
        WHERE IdProveedor = @IdProveedor;

        SELECT @@ROWCOUNT AS FilasEliminadas;
    END
    ELSE
    BEGIN
        ;THROW 50010, N'Acción no válida. Use: 1 = Guardar (Insert/Update), 2 = Consultar, 3 = Eliminar.', 1;
    END
END;
GO

/****** Objeto: StoredProcedure [dbo].[PA_CRUD_Empleados] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[PA_CRUD_Empleados]
    @Accion INT,
    @IdEmpleado INT = NULL,
    @Nombre VARCHAR(100) = NULL,
    @Puesto VARCHAR(30) = NULL,
    @Telefono VARCHAR(15) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 1 = Guardar (INSERT o UPDATE automático según exista)
    IF @Accion = 1
    BEGIN
        IF @IdEmpleado IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Empleados WHERE IdEmpleado = @IdEmpleado)
        BEGIN
            UPDATE dbo.Empleados
            SET Nombre = ISNULL(@Nombre, Nombre),
                Puesto = ISNULL(@Puesto, Puesto),
                Telefono = ISNULL(@Telefono, Telefono)
            WHERE IdEmpleado = @IdEmpleado;

            SELECT N'ACTUALIZADO' AS AccionRealizada, @IdEmpleado AS IdEmpleado;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Empleados (Nombre, Puesto, Telefono)
            VALUES (@Nombre, @Puesto, @Telefono);

            SELECT N'INSERTADO' AS AccionRealizada, CAST(SCOPE_IDENTITY() AS INT) AS IdEmpleado;
        END
    END
    -- 2 = Consultar
    ELSE IF @Accion = 2
    BEGIN
        SELECT IdEmpleado, Nombre, Puesto, Telefono
        FROM dbo.Empleados
        WHERE @IdEmpleado IS NULL OR IdEmpleado = @IdEmpleado
        ORDER BY IdEmpleado;
    END
    -- 3 = Eliminar
    ELSE IF @Accion = 3
    BEGIN
        DELETE FROM dbo.Empleados
        WHERE IdEmpleado = @IdEmpleado;

        SELECT @@ROWCOUNT AS FilasEliminadas;
    END
    ELSE
    BEGIN
        ;THROW 50010, N'Acción no válida. Use: 1 = Guardar (Insert/Update), 2 = Consultar, 3 = Eliminar.', 1;
    END
END;
GO

/****** Objeto: StoredProcedure [dbo].[PA_CRUD_Ventas] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[PA_CRUD_Ventas]
    @Accion INT,
    @IdVenta INT = NULL,
    @FechaVenta DATE = NULL,
    @IdEmpleado INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 1 = Guardar (INSERT o UPDATE automático según exista)
    IF @Accion = 1
    BEGIN
        IF @IdVenta IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Ventas WHERE IdVenta = @IdVenta)
        BEGIN
            UPDATE dbo.Ventas
            SET FechaVenta = ISNULL(@FechaVenta, FechaVenta),
                IdEmpleado = ISNULL(@IdEmpleado, IdEmpleado)
            WHERE IdVenta = @IdVenta;

            SELECT N'ACTUALIZADO' AS AccionRealizada, @IdVenta AS IdVenta;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Ventas (FechaVenta, IdEmpleado)
            VALUES (ISNULL(@FechaVenta, CAST(GETDATE() AS DATE)), @IdEmpleado);

            SELECT N'INSERTADO' AS AccionRealizada, CAST(SCOPE_IDENTITY() AS INT) AS IdVenta;
        END
    END
    -- 2 = Consultar
    ELSE IF @Accion = 2
    BEGIN
        SELECT IdVenta, FechaVenta, IdEmpleado
        FROM dbo.Ventas
        WHERE @IdVenta IS NULL OR IdVenta = @IdVenta
        ORDER BY IdVenta;
    END
    -- 3 = Eliminar
    ELSE IF @Accion = 3
    BEGIN
        DELETE FROM dbo.Ventas
        WHERE IdVenta = @IdVenta;

        SELECT @@ROWCOUNT AS FilasEliminadas;
    END
    ELSE
    BEGIN
        ;THROW 50010, N'Acción no válida. Use: 1 = Guardar (Insert/Update), 2 = Consultar, 3 = Eliminar.', 1;
    END
END;
GO

/****** Objeto: StoredProcedure [dbo].[PA_CRUD_DetalleVenta] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[PA_CRUD_DetalleVenta]
    @Accion INT,
    @IdDetalle INT = NULL,
    @IdVenta INT = NULL,
    @IdProducto INT = NULL,
    @Cantidad INT = NULL,
    @PrecioUnitario DECIMAL(10, 2) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 1 = Guardar (INSERT o UPDATE automático según exista)
    IF @Accion = 1
    BEGIN
        IF @IdDetalle IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.DetalleVenta WHERE IdDetalle = @IdDetalle)
        BEGIN
            UPDATE dbo.DetalleVenta
            SET IdVenta = ISNULL(@IdVenta, IdVenta),
                IdProducto = ISNULL(@IdProducto, IdProducto),
                Cantidad = ISNULL(@Cantidad, Cantidad),
                PrecioUnitario = ISNULL(@PrecioUnitario, PrecioUnitario)
            WHERE IdDetalle = @IdDetalle;

            SELECT N'ACTUALIZADO' AS AccionRealizada, @IdDetalle AS IdDetalle;
        END
        ELSE
        BEGIN
            DECLARE @PrecioFinal DECIMAL(10, 2) = @PrecioUnitario;

            IF @PrecioFinal IS NULL
            BEGIN
                SELECT @PrecioFinal = Precio
                FROM dbo.Productos
                WHERE IdProducto = @IdProducto;
            END;

            INSERT INTO dbo.DetalleVenta (IdVenta, IdProducto, Cantidad, PrecioUnitario)
            VALUES (@IdVenta, @IdProducto, ISNULL(@Cantidad, 1), @PrecioFinal);

            SELECT N'INSERTADO' AS AccionRealizada, CAST(SCOPE_IDENTITY() AS INT) AS IdDetalle;
        END
    END
    -- 2 = Consultar
    ELSE IF @Accion = 2
    BEGIN
        SELECT IdDetalle, IdVenta, IdProducto, Cantidad, PrecioUnitario
        FROM dbo.DetalleVenta
        WHERE (@IdDetalle IS NULL OR IdDetalle = @IdDetalle)
          AND (@IdVenta IS NULL OR IdVenta = @IdVenta)
        ORDER BY IdDetalle;
    END
    -- 3 = Eliminar
    ELSE IF @Accion = 3
    BEGIN
        DELETE FROM dbo.DetalleVenta
        WHERE IdDetalle = @IdDetalle;

        SELECT @@ROWCOUNT AS FilasEliminadas;
    END
    ELSE
    BEGIN
        ;THROW 50010, N'Acción no válida. Use: 1 = Guardar (Insert/Update), 2 = Consultar, 3 = Eliminar.', 1;
    END
END;
GO

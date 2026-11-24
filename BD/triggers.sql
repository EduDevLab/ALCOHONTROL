USE [alcohontrol]
GO

/****** Objeto: Trigger [dbo].[TR_DetalleVenta_Insert_DescontarStock] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER TRIGGER [dbo].[TR_DetalleVenta_Insert_DescontarStock]
ON [dbo].[DetalleVenta]
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM inserted)
        RETURN;

    IF EXISTS (
        SELECT 1
        FROM dbo.Productos P
        INNER JOIN (
            SELECT IdProducto, SUM(Cantidad) AS TotalCantidad
            FROM inserted
            GROUP BY IdProducto
        ) ins ON P.IdProducto = ins.IdProducto
        WHERE P.Existencias < ins.TotalCantidad
    )
    BEGIN
        ROLLBACK TRANSACTION;
        ;THROW 50001, N'Stock insuficiente para completar la venta.', 1;
    END;

    UPDATE P
    SET P.Existencias = P.Existencias - ins.TotalCantidad
    FROM dbo.Productos P
    INNER JOIN (
        SELECT IdProducto, SUM(Cantidad) AS TotalCantidad
        FROM inserted
        GROUP BY IdProducto
    ) ins ON P.IdProducto = ins.IdProducto;
END;
GO

/****** Objeto: Trigger [dbo].[TR_DetalleVenta_Update_AjustarStock] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER TRIGGER [dbo].[TR_DetalleVenta_Update_AjustarStock]
ON [dbo].[DetalleVenta]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT (UPDATE(Cantidad) OR UPDATE(IdProducto)) OR NOT EXISTS (SELECT 1 FROM inserted)
        RETURN;

    IF EXISTS (
        SELECT 1
        FROM dbo.Productos P
        INNER JOIN (
            SELECT IdProducto, SUM(Delta) AS Delta
            FROM (
                SELECT IdProducto, Cantidad AS Delta FROM deleted
                UNION ALL
                SELECT IdProducto, -Cantidad AS Delta FROM inserted
            ) movimientos
            GROUP BY IdProducto
        ) D ON P.IdProducto = D.IdProducto
        WHERE P.Existencias + D.Delta < 0
    )
    BEGIN
        ROLLBACK TRANSACTION;
        ;THROW 50002, N'Stock insuficiente para actualizar el detalle de venta.', 1;
    END;

    UPDATE P
    SET P.Existencias = P.Existencias + D.Delta
    FROM dbo.Productos P
    INNER JOIN (
        SELECT IdProducto, SUM(Delta) AS Delta
        FROM (
            SELECT IdProducto, Cantidad AS Delta FROM deleted
            UNION ALL
            SELECT IdProducto, -Cantidad AS Delta FROM inserted
        ) movimientos
        GROUP BY IdProducto
    ) D ON P.IdProducto = D.IdProducto
    WHERE D.Delta <> 0;
END;
GO

/****** Objeto: Trigger [dbo].[TR_DetalleVenta_Delete_DevolverStock] ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER TRIGGER [dbo].[TR_DetalleVenta_Delete_DevolverStock]
ON [dbo].[DetalleVenta]
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM deleted)
        RETURN;

    UPDATE P
    SET P.Existencias = P.Existencias + del.TotalCantidad
    FROM dbo.Productos P
    INNER JOIN (
        SELECT IdProducto, SUM(Cantidad) AS TotalCantidad
        FROM deleted
        GROUP BY IdProducto
    ) del ON P.IdProducto = del.IdProducto;
END;
GO

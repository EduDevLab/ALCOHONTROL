export interface Categoria {
  IdCategorias: number;
  Nombre: string;
}

export interface Proveedor {
  IdProveedor: number;
  Nombre: string;
  Telefono: string;
}

export interface Empleado {
  IdEmpleado: number;
  Nombre: string;
  Puesto: string;
  Telefono: string;
}

export interface Producto {
  IdProducto: number;
  Nombre: string;
  IdCategorias: number;
  Precio: number;
  Existencias: number;
  IdProveedor: number;
}

export interface ReporteProducto {
  IdProducto: number;
  Producto: string;
  Categoria: string;
  Proveedor: string;
  Precio: number;
  Existencias: number;
  ValorTotalInventario: number;
}

export interface ProductoStockBajo {
  IdProducto: number;
  Producto: string;
  Categoria: string;
  Proveedor: string;
  TelefonoProveedor: string;
  Precio: number;
  Existencias: number;
}

export interface VentaResumen {
  IdVenta: number;
  FechaVenta: string;
  IdEmpleado?: number;
  Empleado: string;
  TotalArticulosVendidos: number;
  TotalVenta: number;
}

export interface DetalleVentaItem {
  IdDetalle: number;
  IdVenta: number;
  FechaVenta: string;
  Producto: string;
  Cantidad: number;
  PrecioUnitario: number;
  Subtotal: number;
}

export interface VentaPorEmpleado {
  IdEmpleado: number;
  Empleado: string;
  Puesto: string;
  TotalVentas: number;
  TotalArticulosVendidos: number;
  MontoTotalVendido: number;
}

export interface VentaPorCategoria {
  IdCategorias: number;
  Categoria: string;
  TotalArticulosVendidos: number;
  MontoTotalVendido: number;
}

export type TipoCorte = 'diario' | 'semanal' | 'mensual';

export interface CorteVentas {
  tipo: TipoCorte;
  desde: string;
  hasta: string;
  resumen: {
    totalVentas: number;
    totalArticulos: number;
    ingresoTotal: number;
    ticketPromedio: number;
  };
  porEmpleado: VentaPorEmpleado[];
  porCategoria: VentaPorCategoria[];
  ventas: VentaResumen[];
}

export interface ProductoCroquisDetalle {
  IdProducto: number;
  Producto: string;
  Categoria: string;
  Proveedor: string;
  Precio: number;
  Existencias: number;
  stockBajo: boolean;
  agotado: boolean;
}

export interface ZonaCroquis {
  id: string;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  productos: number[];
  productosDetalle?: ProductoCroquisDetalle[];
  totalProductos?: number;
  totalStockBajo?: number;
  totalAgotados?: number;
}

export interface CroquisResponse {
  actualizadoEn: string;
  canvasWidth: number;
  canvasHeight: number;
  zonas: ZonaCroquis[];
}

export type VistaId = 'dashboard' | 'pos' | 'croquis' | 'inventario' | 'cortes' | 'empleados';

export function esAdministrador(puesto: string): boolean {
  return puesto.trim().toLowerCase().includes('admin');
}

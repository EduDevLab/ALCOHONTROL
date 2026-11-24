import type {
  Categoria,
  CorteVentas,
  CroquisResponse,
  DetalleVentaItem,
  Empleado,
  Producto,
  ProductoStockBajo,
  Proveedor,
  ReporteProducto,
  TipoCorte,
  VentaPorEmpleado,
  VentaResumen,
  ZonaCroquis,
} from '../types/alcohontrol.ts';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (payload && typeof payload.error === 'string' && payload.error) ||
      `Error HTTP ${response.status} al consultar ${path}`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

export const api = {
  health: () => request<{ ok: boolean; database: string }>('/health'),

  productos: {
    listar: () => request<Producto[]>('/productos'),
    obtener: (id: number) => request<Producto>(`/productos/${id}`),
    crear: (data: Omit<Producto, 'IdProducto'>) =>
      request<{ AccionRealizada: string; IdProducto: number }>('/productos', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    actualizar: (id: number, data: Partial<Omit<Producto, 'IdProducto'>>) =>
      request<{ AccionRealizada: string; IdProducto: number }>(`/productos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    ajustarExistencias: (id: number, body: { delta: number } | { Existencias: number }) =>
      request<{ IdProducto: number; ExistenciasAnteriores: number; Existencias: number }>(
        `/productos/${id}/existencias`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
      ),
    eliminar: (id: number) =>
      request<{ FilasEliminadas: number }>(`/productos/${id}`, {
        method: 'DELETE',
      }),
  },

  categorias: {
    listar: () => request<Categoria[]>('/categorias'),
    crear: (data: Omit<Categoria, 'IdCategorias'>) =>
      request<{ AccionRealizada: string; IdCategorias: number }>('/categorias', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    actualizar: (id: number, data: Omit<Categoria, 'IdCategorias'>) =>
      request<{ AccionRealizada: string; IdCategorias: number }>(`/categorias/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    eliminar: (id: number) =>
      request<{ FilasEliminadas: number }>(`/categorias/${id}`, {
        method: 'DELETE',
      }),
  },

  proveedores: {
    listar: () => request<Proveedor[]>('/proveedores'),
    crear: (data: Omit<Proveedor, 'IdProveedor'>) =>
      request<{ AccionRealizada: string; IdProveedor: number }>('/proveedores', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    actualizar: (id: number, data: Partial<Omit<Proveedor, 'IdProveedor'>>) =>
      request<{ AccionRealizada: string; IdProveedor: number }>(`/proveedores/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    eliminar: (id: number) =>
      request<{ FilasEliminadas: number }>(`/proveedores/${id}`, {
        method: 'DELETE',
      }),
  },

  empleados: {
    listar: () => request<Empleado[]>('/empleados'),
    crear: (data: Omit<Empleado, 'IdEmpleado'>) =>
      request<{ AccionRealizada: string; IdEmpleado: number }>('/empleados', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    actualizar: (id: number, data: Partial<Omit<Empleado, 'IdEmpleado'>>) =>
      request<{ AccionRealizada: string; IdEmpleado: number }>(`/empleados/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    eliminar: (id: number) =>
      request<{ FilasEliminadas: number }>(`/empleados/${id}`, {
        method: 'DELETE',
      }),
  },

  ventas: {
    listar: (params?: { desde?: string; hasta?: string; idEmpleado?: number }) => {
      const qs = new URLSearchParams();
      if (params?.desde) qs.set('desde', params.desde);
      if (params?.hasta) qs.set('hasta', params.hasta);
      if (params?.idEmpleado) qs.set('idEmpleado', String(params.idEmpleado));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request<VentaResumen[]>(`/ventas${suffix}`);
    },
    detalle: (idVenta: number) => request<DetalleVentaItem[]>(`/ventas/${idVenta}/detalle`),
    registrar: (payload: {
      IdEmpleado: number;
      FechaVenta?: string;
      items: Array<{ IdProducto: number; Cantidad: number; PrecioUnitario?: number }>;
    }) =>
      request<{ mensaje: string; venta: VentaResumen }>('/ventas', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  reportes: {
    productos: () => request<ReporteProducto[]>('/reportes/productos'),
    stockBajo: () => request<ProductoStockBajo[]>('/reportes/stock-bajo'),
    empleados: () => request<VentaPorEmpleado[]>('/reportes/empleados'),
    corte: (params?: { tipo?: TipoCorte; fecha?: string; desde?: string; hasta?: string }) => {
      const qs = new URLSearchParams();
      if (params?.tipo) qs.set('tipo', params.tipo);
      if (params?.fecha) qs.set('fecha', params.fecha);
      if (params?.desde) qs.set('desde', params.desde);
      if (params?.hasta) qs.set('hasta', params.hasta);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request<CorteVentas>(`/reportes/corte${suffix}`);
    },
  },

  croquis: {
    obtener: () => request<CroquisResponse>('/croquis'),
    guardar: (zonas: Array<Pick<ZonaCroquis, 'id' | 'nombre' | 'x' | 'y' | 'width' | 'height' | 'color' | 'productos'>>) =>
      request<CroquisResponse>('/croquis', {
        method: 'PUT',
        body: JSON.stringify({ zonas }),
      }),
  },
};

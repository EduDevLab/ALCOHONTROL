import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../db.ts';
import { handleSqlError } from '../utils/http.ts';

export const croquisRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const CROQUIS_PATH = path.join(DATA_DIR, 'croquis.json');

const DEFAULT_CANVAS_W = 1100;
const DEFAULT_CANVAS_H = 540;
const MIN_CANVAS_W = 480;
const MAX_CANVAS_W = 1800;
const MIN_CANVAS_H = 280;
const MAX_CANVAS_H = 1000;

function clampDimension(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export interface ZonaCroquisConfig {
  id: string;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  productos: number[];
}

export interface CroquisFile {
  zonas: ZonaCroquisConfig[];
  canvasWidth?: number;
  canvasHeight?: number;
  actualizadoEn: string;
}

const DEFAULT_CROQUIS: CroquisFile = {
  actualizadoEn: new Date().toISOString(),
  canvasWidth: DEFAULT_CANVAS_W,
  canvasHeight: DEFAULT_CANVAS_H,
  zonas: [
    { id: 'bodega', nombre: 'Bodega', x: 40, y: 40, width: 320, height: 220, productos: [] },
    { id: 'refrigeradores', nombre: 'Refrigeradores', x: 400, y: 40, width: 360, height: 220, productos: [] },
    { id: 'anaquel', nombre: 'Anaquel', x: 800, y: 40, width: 260, height: 220, productos: [] },
    { id: 'mostrador', nombre: 'Mostrador', x: 40, y: 310, width: 500, height: 180, productos: [] },
    { id: 'botanas', nombre: 'Botanas', x: 580, y: 310, width: 480, height: 180, productos: [] },
  ],
};

async function readOrInitCroquis(): Promise<CroquisFile> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(CROQUIS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as CroquisFile;
    if (Array.isArray(parsed?.zonas)) {
      return parsed;
    }
  } catch {
    // Si no existe o es inválido, inicializamos con las 5 zonas por defecto
  }
  await fs.writeFile(CROQUIS_PATH, JSON.stringify(DEFAULT_CROQUIS, null, 2), 'utf-8');
  return DEFAULT_CROQUIS;
}

async function enrichCroquis(croquis: CroquisFile) {
  const pool = await getPool();
  const productosRes = await pool.request().query(`
    SELECT IdProducto, Producto, Categoria, Proveedor, Precio, Existencias
    FROM dbo.Vista_Reporte_Productos
    ORDER BY IdProducto ASC
  `);

  const byId = new Map<number, (typeof productosRes.recordset)[number]>();
  for (const p of productosRes.recordset) {
    byId.set(Number(p.IdProducto), p);
  }

  const zonasEnriquecidas = croquis.zonas.map((z) => {
    const productosDetalle = z.productos
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        ...p,
        stockBajo: Number(p.Existencias) <= 30 && Number(p.Existencias) > 0,
        agotado: Number(p.Existencias) === 0,
      }));

    return {
      ...z,
      productosDetalle,
      totalProductos: productosDetalle.length,
      totalStockBajo: productosDetalle.filter((p) => p.stockBajo).length,
      totalAgotados: productosDetalle.filter((p) => p.agotado).length,
    };
  });

  return {
    actualizadoEn: croquis.actualizadoEn,
    canvasWidth: clampDimension(croquis.canvasWidth, DEFAULT_CANVAS_W, MIN_CANVAS_W, MAX_CANVAS_W),
    canvasHeight: clampDimension(croquis.canvasHeight, DEFAULT_CANVAS_H, MIN_CANVAS_H, MAX_CANVAS_H),
    zonas: zonasEnriquecidas,
  };
}

croquisRouter.get('/croquis', async (_req, res) => {
  try {
    const croquis = await readOrInitCroquis();
    const enriched = await enrichCroquis(croquis);
    res.json(enriched);
  } catch (err) {
    handleSqlError(res, err, 'Error al cargar el croquis del expendio.');
  }
});

croquisRouter.put('/croquis', async (req, res) => {
  const { zonas, canvasWidth, canvasHeight } = req.body ?? {};
  if (!Array.isArray(zonas)) {
    res.status(400).json({ error: 'El cuerpo debe incluir un arreglo "zonas".' });
    return;
  }

  const sanitizedCanvasWidth = clampDimension(canvasWidth, DEFAULT_CANVAS_W, MIN_CANVAS_W, MAX_CANVAS_W);
  const sanitizedCanvasHeight = clampDimension(canvasHeight, DEFAULT_CANVAS_H, MIN_CANVAS_H, MAX_CANVAS_H);

  const sanitized: ZonaCroquisConfig[] = [];
  for (const z of zonas) {
    if (
      typeof z?.id !== 'string' ||
      !z.id.trim() ||
      typeof z?.nombre !== 'string' ||
      !z.nombre.trim() ||
      !Number.isFinite(Number(z?.x)) ||
      !Number.isFinite(Number(z?.y)) ||
      !Number.isFinite(Number(z?.width)) ||
      !Number.isFinite(Number(z?.height)) ||
      Number(z.width) <= 0 ||
      Number(z.height) <= 0
    ) {
      res.status(400).json({ error: 'Cada zona debe tener id, nombre, x, y, width (> 0) y height (> 0) válidos.' });
      return;
    }

    const productos: number[] = Array.isArray(z.productos)
      ? Array.from(
          new Set<number>(
            z.productos.map((p: unknown) => Number(p)).filter((n: number) => Number.isInteger(n) && n > 0),
          ),
        )
      : [];

    sanitized.push({
      id: z.id.trim(),
      nombre: z.nombre.trim(),
      x: Math.round(Number(z.x)),
      y: Math.round(Number(z.y)),
      width: Math.round(Number(z.width)),
      height: Math.round(Number(z.height)),
      ...(typeof z.color === 'string' && z.color.trim() ? { color: z.color.trim() } : {}),
      productos,
    });
  }

  try {
    const payload: CroquisFile = {
      actualizadoEn: new Date().toISOString(),
      canvasWidth: sanitizedCanvasWidth,
      canvasHeight: sanitizedCanvasHeight,
      zonas: sanitized,
    };
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CROQUIS_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    const enriched = await enrichCroquis(payload);
    res.json(enriched);
  } catch (err) {
    handleSqlError(res, err, 'Error al guardar el croquis del expendio.');
  }
});

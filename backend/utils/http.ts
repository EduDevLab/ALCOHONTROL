import type { Response } from 'express';
import { extractSqlError } from '../db.ts';

/**
 * Convierte un parámetro a entero positivo o retorna `null` si es inválido.
 */
export function parsePositiveInt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }
  return num;
}

/**
 * Valida formato de fecha YYYY-MM-DD.
 */
export function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Mapea errores de SQL Server a respuestas HTTP claras y consistentes.
 */
export function handleSqlError(res: Response, err: unknown, fallbackMessage: string): void {
  const { number, message } = extractSqlError(err);

  // Errores personalizados de triggers de stock (50001 / 50002) o validaciones de SP (50010)
  if (number === 50001 || number === 50002 || number === 50010 || message.includes('Stock insuficiente')) {
    res.status(400).json({ error: message, code: number });
    return;
  }

  // Violación de FK / CHECK (547) o duplicado (2627 / 2601)
  if (number === 547) {
    const isConstraint = message.toLowerCase().includes('check') || message.toLowerCase().includes('ck_');
    if (isConstraint) {
      res.status(400).json({ error: `Datos inválidos según restricción de base de datos: ${message}`, code: number });
      return;
    }
    res.status(409).json({
      error: 'No se puede completar la operación porque existen registros relacionados o una referencia inválida.',
      code: number,
    });
    return;
  }

  if (number === 2627 || number === 2601) {
    res.status(409).json({ error: 'Ya existe un registro con esos datos.', code: number });
    return;
  }

  console.error(fallbackMessage, err);
  res.status(500).json({ error: fallbackMessage, detail: message });
}

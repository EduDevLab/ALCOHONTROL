import 'dotenv/config';
import sql from 'mssql/msnodesqlv8.js';

const server = process.env.DB_SERVER || '.\\ISOF26';
const database = process.env.DB_NAME || 'alcohontrol';
const driver = process.env.DB_DRIVER || 'ODBC Driver 17 for SQL Server';
const trustedConnection = (process.env.DB_TRUSTED ?? 'true').toLowerCase() !== 'false';

const config: sql.config = {
  server,
  database,
  driver,
  options: {
    trustedConnection,
    trustServerCertificate: true,
  },
  ...(trustedConnection
    ? {}
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }),
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

/**
 * Obtiene o inicializa el pool de conexiones hacia SQL Server (`alcohontrol`).
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(config);
    pool.on('error', (err) => {
      console.error('Error en pool de SQL Server:', err);
      poolPromise = null;
    });
    poolPromise = pool.connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

export interface SqlErrorDetails {
  number?: number;
  message: string;
}

/**
 * Extrae el código y mensaje de un error proveniente de SQL Server / msnodesqlv8.
 */
export function extractSqlError(err: unknown): SqlErrorDetails {
  if (!err || typeof err !== 'object') {
    return { message: 'Error desconocido de base de datos.' };
  }

  const record = err as {
    number?: number;
    code?: number | string;
    message?: string;
    originalError?: {
      info?: { number?: number; message?: string };
      message?: string;
      code?: number | string;
    };
    precedingErrors?: Array<{ number?: number; message?: string }>;
  };

  const number =
    record.number ??
    record.originalError?.info?.number ??
    record.precedingErrors?.[0]?.number ??
    (typeof record.code === 'number' ? record.code : undefined);

  const rawMessage =
    record.originalError?.info?.message ??
    record.precedingErrors?.[0]?.message ??
    record.originalError?.message ??
    record.message ??
    'Error en la operación de base de datos.';

  // Limpiar prefijo ODBC típico: "[Microsoft][ODBC Driver 17 for SQL Server][SQL Server]..."
  const cleaned = rawMessage.replace(/^(\[[^\]]+\])+\s*/g, '').trim();

  return {
    number,
    message: cleaned || rawMessage,
  };
}

export { sql };

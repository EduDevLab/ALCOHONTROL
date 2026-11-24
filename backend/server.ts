import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getPool } from './db.ts';
import { catalogosRouter } from './routes/catalogos.ts';
import { ventasRouter } from './routes/ventas.ts';
import { reportesRouter } from './routes/reportes.ts';
import { croquisRouter } from './routes/croquis.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ mensaje: 'API de ALCOHONTROL activa' });
});

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ ok: true, database: 'alcohontrol' });
  } catch (err) {
    console.error('Healthcheck fallido:', err);
    res.status(503).json({ ok: false, error: 'Sin conexión a SQL Server.' });
  }
});

app.use('/api', catalogosRouter);
app.use('/api', ventasRouter);
app.use('/api', reportesRouter);
app.use('/api', croquisRouter);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

import cors from 'cors';
import express from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { env, isOriginAllowed } from './config/env.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.set('trust proxy', true);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);
app.use(express.json());

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
if (!existsSync(uploadsRoot)) {
  mkdirSync(uploadsRoot, { recursive: true });
}

app.use('/uploads', express.static(uploadsRoot));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'studysync-backend',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiRouter);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error.' });
});

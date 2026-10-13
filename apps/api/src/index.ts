import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { router } from './routes';
import { errorHandler } from './middleware/error';
import { logger } from './lib/logger';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.use('/api/v1', router);
app.use((_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Not found' } }));
app.use(errorHandler);

app.listen(config.port, () => logger.info(`API listening on http://localhost:${config.port}/api/v1`));

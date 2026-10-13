import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';

// One error shape everywhere: { error: { code, message, fields } }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of err.issues) fields[i.path.join('.')] = i.message;
    return res.status(400).json({ error: { code: 'validation_failed', message: 'Invalid input', fields } });
  }
  logger.error({ err }, 'unhandled error');
  return res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
}

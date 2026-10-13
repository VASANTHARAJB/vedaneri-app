import { Router } from 'express';
import { HttpError } from '../lib/httpError';

// Placeholder router: every route returns 501 until its build step.
export function notImplemented(name: string) {
  const r = Router();
  r.use((_req, _res, next) => next(new HttpError(501, 'not_implemented', `${name} is not built yet`)));
  return r;
}

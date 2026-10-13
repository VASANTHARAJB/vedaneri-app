import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { HttpError } from '../lib/httpError';

export type Role = 'super_admin' | 'editor' | 'accounts' | 'seva_manager';
export interface AuthUser { id: number; role: Role; type: 'admin' | 'devotee' }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

// Web clients send an httpOnly cookie; Flutter apps send a Bearer token.
function readToken(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return req.cookies?.access_token;
}

export function requireAuth(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = readToken(req);
    if (!token) return next(new HttpError(401, 'unauthenticated', 'Login required'));
    try {
      const p = jwt.verify(token, config.jwt.accessSecret) as unknown as AuthUser;
      if (roles.length && !(p.role === 'super_admin' || roles.includes(p.role))) {
        return next(new HttpError(403, 'forbidden', 'You do not have access to this'));
      }
      req.user = { id: p.id, role: p.role, type: p.type };
      next();
    } catch {
      next(new HttpError(401, 'invalid_token', 'Session expired, please login again'));
    }
  };
}

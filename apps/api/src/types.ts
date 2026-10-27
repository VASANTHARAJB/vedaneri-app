import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
export const SITE_URL = import.meta.env.VITE_SITE_URL || 'http://localhost:3000';

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;

  constructor(message: string, status = 400, fields?: Record<string, string>, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
    this.code = code;
  }
}
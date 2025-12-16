import { Response } from 'express';

/**
 * Standard API Response Format (JSON:API inspired)
 * 
 * Success: { success: true, data: T, meta?: { total, limit, offset } }
 * Error: { success: false, error: { code: string, message: string, details?: any } }
 */

export interface ApiMeta {
  total?: number;
  limit?: number;
  offset?: number;
  [key: string]: any;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * HTTP status code to error code mapping
 */
const ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Send a standardized success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ApiMeta
): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  res.status(statusCode).json(response);
}

/**
 * Send a standardized error response
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  details?: any
): void {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: ERROR_CODES[statusCode] || 'ERROR',
      message,
    },
  };
  
  if (details) {
    response.error.details = details;
  }
  
  res.status(statusCode).json(response);
}

/**
 * Send a paginated list response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  limit: number,
  offset: number
): void {
  sendSuccess(res, data, 200, { total, limit, offset });
}

/**
 * Convenience error methods following RFC 7807 (Problem Details) naming
 */
export const errors = {
  badRequest: (res: Response, message: string, details?: any) =>
    sendError(res, 400, message, details),
  
  unauthorized: (res: Response, message: string = 'Unauthorized') =>
    sendError(res, 401, message),
  
  forbidden: (res: Response, message: string = 'Forbidden') =>
    sendError(res, 403, message),
  
  notFound: (res: Response, message: string = 'Not Found') =>
    sendError(res, 404, message),
  
  conflict: (res: Response, message: string) =>
    sendError(res, 409, message),
  
  gone: (res: Response, message: string) =>
    sendError(res, 410, message),
  
  validation: (res: Response, details: any) =>
    sendError(res, 422, 'Validation Error', details),
  
  tooManyRequests: (res: Response, message: string = 'Too Many Requests') =>
    sendError(res, 429, message),
  
  internal: (res: Response, message: string = 'Internal Server Error') =>
    sendError(res, 500, message),
};

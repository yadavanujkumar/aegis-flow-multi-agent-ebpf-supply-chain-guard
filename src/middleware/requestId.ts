import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Middleware that assigns every incoming request a unique correlation ID.
 *
 * If the caller supplies an `X-Request-Id` header the value is re-used;
 * otherwise a v4 UUID is generated.  The ID is attached to `req.headers`
 * (so downstream middleware/handlers can read it) and echoed back in the
 * response via the `X-Request-Id` header for easy client-side correlation.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}

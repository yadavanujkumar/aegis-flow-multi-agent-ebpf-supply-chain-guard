import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config';
import { logger } from '../infrastructure/Logger';

/**
 * Performs a constant-time comparison of two strings to prevent timing attacks.
 * Returns `false` immediately when the lengths differ (the length is not secret),
 * otherwise delegates to `crypto.timingSafeEqual`.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * API-key authentication middleware.
 * If API_KEY is configured in the environment, every request must supply it
 * via the `X-API-Key` header.  Unauthenticated requests receive 401.
 *
 * The comparison uses `crypto.timingSafeEqual` to prevent timing-based
 * side-channel attacks that could leak the key value.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.API_KEY) {
    next();
    return;
  }

  const provided = req.headers['x-api-key'];
  if (typeof provided !== 'string' || !safeCompare(provided, config.API_KEY)) {
    logger.warn('Unauthorized request – invalid or missing API key', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({ error: 'Unauthorized', message: 'Valid X-API-Key header is required.' });
    return;
  }

  next();
}

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../infrastructure/Logger';

/**
 * API-key authentication middleware.
 * If API_KEY is configured in the environment, every request must supply it
 * via the `X-API-Key` header.  Unauthenticated requests receive 401.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.API_KEY) {
    next();
    return;
  }

  const provided = req.headers['x-api-key'];
  if (!provided || provided !== config.API_KEY) {
    logger.warn('Unauthorized request – invalid or missing API key', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({ error: 'Unauthorized', message: 'Valid X-API-Key header is required.' });
    return;
  }

  next();
}

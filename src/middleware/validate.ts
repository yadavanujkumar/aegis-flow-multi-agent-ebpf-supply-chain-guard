import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { logger } from '../infrastructure/Logger';

/**
 * Factory that returns an Express middleware which validates `req.body`
 * against the provided Zod schema.  Returns 422 with structured errors on
 * failure so callers get actionable feedback instead of a 500.
 */
export function validateBody(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = (result.error as ZodError).issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      logger.warn('Request body validation failed', { path: req.path, issues });
      res.status(422).json({ error: 'Validation Error', issues });
      return;
    }
    req.body = result.data;
    next();
  };
}

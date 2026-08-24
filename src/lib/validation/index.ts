/**
 * Deep validation module — single Zod pipeline hiding sanitization.
 * Previously: sanitize.middleware.ts (express-validator, 5 chains) + validators/auth.validator.ts (Zod) + validate.middleware.ts (dual-library check)
 * Now: Zod schemas own sanitization via transforms; `validate` factory is the sole public entry point.
 *
 * Dependency: 1. In-process — pure computation, no I/O.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodIssue, ZodType } from 'zod';
import { ApiError } from '../../utils/ApiError';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Unified validate middleware — validates `req.body` (and optionally `req.params`/`req.query`) against Zod schema.
 * - Sanitization is declared in schemas via .trim().toLowerCase().transform(escapeHtml) — no express-validator.
 * - On success, assigns parsed (sanitized) data back to req.body so handlers receive normalized values.
 * - On failure, throws ApiError(400) with field-level errors.
 */
export const validate =
  (schema: ZodType<any>, opts: { location?: 'body' | 'params' | 'query' | 'body+params' } = {}) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const location = opts.location ?? 'body';
    let data: any;
    if (location === 'body') data = req.body;
    else if (location === 'params') data = req.params;
    else if (location === 'query') data = req.query;
    else if (location === 'body+params') data = { ...req.body, ...req.params };

    const result = schema.safeParse(data);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: ZodIssue) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return next(new ApiError(400, 'Validation failed', errorMessages));
    }

    // assign sanitized data back — hides sanitization from handlers
    if (location === 'body') req.body = result.data;
    else if (location === 'params') req.params = result.data;
    else if (location === 'query') req.query = result.data as any;
    else if (location === 'body+params') {
      // split back: Zod schema typically includes both; assign to body for handler convenience
      req.body = result.data;
    }

    next();
  };

// Schemas remain in validators/auth.validator.ts (single source with transforms); import via 'validators/auth.validator' or via this deep module entry.
// No re-export to avoid circular — deep module's public contract is `validate` factory; schemas are co-located but separately imported.

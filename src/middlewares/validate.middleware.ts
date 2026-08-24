import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodIssue } from 'zod';
import { ApiError } from '../utils/ApiError';

/**
 * Deep validation pipeline — single Zod entry point, sanitization owned by schemas.
 * Previously: checked express-validator then Zod (dual-library, 3-file bounce).
 * Now: pure Zod (schemas declare .trim().toLowerCase().transform(escapeHtml) etc.), assigns sanitized data back.
 *
 * Deep module hides: trim, normalizeEmail, escapeHtml, regex, length checks — all in validators/auth.validator.ts via Zod transforms.
 * Re-exported via src/lib/validation for new code; this file remains canonical for backward compat.
 */
export const validate = (schema: ZodType<any>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errorMessages = result.error.issues.map((err: ZodIssue) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return next(new ApiError(400, 'Validation failed', errorMessages));
    }
    // sanitized data (trimmed, lowercased, escaped) hides sanitization from handlers
    req.body = result.data;
    next();
  };
};

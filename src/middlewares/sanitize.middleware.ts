/**
 * @deprecated — Shallow sanitize chains (express-validator) are superseded by Zod transforms in validators/auth.validator.ts.
 * Previously 5 chains (sanitizeRegistration, sanitizeLogin, etc.) duplicated Zod regex/length rules and required
 * bouncing between routes → sanitize → validators → validate middleware.
 *
 * Deep module consolidates sanitization into Zod schemas (.trim().toLowerCase().transform(escapeHtml)) and
 * single validate() middleware (validate.middleware.ts / lib/validation). This file now exports no-ops for backward compat.
 * Remove in next major version; migrate callers to `validate(schema)` alone.
 */
import { Request, Response, NextFunction } from 'express';
import logger from '../logger/winston.logger';

function deprecationWarning(name: string) {
  if (process.env.NODE_ENV !== 'test') logger.warn(`[DEPRECATED] ${name} is a no-op — sanitization now handled by Zod schemas (validators/auth.validator.ts). Remove sanitize middleware from route.`);
}

function noopMiddleware(name: string) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    deprecationWarning(name);
    next();
  };
}

// Backward compat: previously `body('email').isEmail().normalizeEmail().trim().escape()` etc.
// Now Zod does .trim().toLowerCase().transform(escapeHtml).pipe(z.string().email())
export const sanitizeRegistration = [noopMiddleware('sanitizeRegistration')] as any;
export const sanitizeLogin = [noopMiddleware('sanitizeLogin')] as any;
export const sanitizePasswordChange = [noopMiddleware('sanitizePasswordChange')] as any;
export const sanitizePasswordReset = [noopMiddleware('sanitizePasswordReset')] as any;
export const sanitizeUsernameUpdate = [noopMiddleware('sanitizeUsernameUpdate')] as any;

# RFC: Deepen Validation Pipeline — Single Zod Module

## Problem

**Three shallow modules owning one concept** — `middlewares/sanitize.middleware.ts:82` (5 `express-validator` chains), `validators/auth.validator.ts:85` (8 Zod schemas), `middlewares/validate.middleware.ts:33` (dual-library `validationResult` then `schema.parse`) are tightly coupled yet fragmented across files. To understand one flow (e.g., `POST /register` `routes/auth/user.routes.ts:60`) you bounce 3 files: `sanitizeRegistration` → `validate(registerSchema)` → `registerSchema` definition, plus the route wiring itself. `validate` conflates two libraries: first checks `express-validator` errors, then Zod `issues`, throwing unified `ApiError` but with two error shapes (`param/path` vs `path` join).

Duplication: same rules encoded twice — `username` `/^[a-zA-Z0-9_]+$/` and `min 3 max 50` in both `sanitize.middleware.ts:16` and `auth.validator.ts:5`, `password` 8-char + special-char regex in both, `email` `isEmail`/`normalizeEmail`/`trim`/`escape` in sanitize vs `z.string().email()` in Zod. `sanitizePasswordReset:63` validates `resetToken` (body field) while route uses `:resetToken` param — drift.

Shallow interfaces: each sanitize export is `body('email').isEmail().normalizeEmail().trim().escape()` — one chain, one field, interface equals implementation. `validate` is 20 LoC wrapper around two libraries, not a domain. Every new endpoint requires editing 4 places (route + sanitize + validator + validate import) and remembering `sanitizeRegistration, validate(registerSchema)` order.

Integration risk in seams: sanitize runs `escape()` (HTML-entity) before Zod sees value, changing length and potentially bypassing `min 3` after escape (`&` → `&amp;`); Zod then re-validates without escape awareness. Handlers receive unsanitized `req.body` (original not parsed `result.data`), so they see unnormalized email (`TEST@Example.COM` vs `test@example.com`) unless they re-trim.

## Proposed Interface

**Deep module `src/lib/validation` — single Zod pipeline hides sanitization, single `validate(schema)` factory.**

### File topology (after)
- `src/lib/validation/index.ts:1` — deep module, owns `validate` factory + helpers `escapeHtml`, `normalizeEmail` (previously scattered)
- `src/validators/auth.validator.ts:1` — schemas own sanitization via Zod transforms (`.trim().toLowerCase().transform(escapeHtml).pipe(z.string().email())`)
- `src/middlewares/validate.middleware.ts:1` — single Zod path, assigns sanitized `result.data` back to `req.body` (hides normalization from handlers), canonical error shape `ApiError(400, 'Validation failed', [{field,message}])`
- `src/middlewares/sanitize.middleware.ts:1` — deprecated no-ops (logs warning, calls `next()`) for backward compat

### Public surface

```typescript
// src/middlewares/validate.middleware.ts / src/lib/validation/index.ts
export const validate = (schema: ZodType<any>) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(new ApiError(400, 'Validation failed',
    result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))));
  req.body = result.data; // sanitized (trimmed, lowercased, escaped)
  next();
};

// src/validators/auth.validator.ts — schemas hide sanitization
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().transform(escapeHtml).pipe(z.string().email('Invalid email format')),
  username: z.string().trim().transform(escapeHtml).pipe(
    z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
  ),
  password: z.string().trim().pipe(
    z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Password must contain ...')
  ),
});
// similarly: loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, updateUsernameSchema
```

### Usage — before vs after

**Before `routes/auth/user.routes.ts:60` (3 imports, 2 middlewares):**
```typescript
import { sanitizeRegistration, sanitizeLogin } from '../../middlewares/sanitize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { registerSchema } from '../../validators/auth.validator';
router.post('/register', sanitizeRegistration, validate(registerSchema), registerUser);
router.post('/login', sanitizeLogin, validate(loginSchema), loginUser);
router.put('/username', verifyJWT, usernameUpdateLimiter, sanitizeUsernameUpdate, validate(updateUsernameSchema), updateUsername);
router.post('/change-password', verifyJWT, sanitizePasswordChange, validate(changePasswordSchema), changeCurrentPassword);
```

**After (1 import, 1 middleware, sanitization hidden):**
```typescript
import { validate } from '../../middlewares/validate.middleware';
// or import { validate } from '../../lib/validation';
import { registerSchema, loginSchema, updateUsernameSchema, changePasswordSchema } from '../../validators/auth.validator';
router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.put('/username', verifyJWT, usernameUpdateLimiter, validate(updateUsernameSchema), updateUsername);
router.post('/change-password', verifyJWT, validate(changePasswordSchema), changeCurrentPassword);
```

Handlers receive sanitized `req.body` (e.g., `test@example.com` not `  TEST@Example.COM  `) without knowing `trim`/`escape` exists. Route file shrinks `136 → 116 LoC` (`routes/auth/user.routes.ts:1`).

### What it hides internally

| Hidden | Previously in `sanitize.middleware.ts` | Now inside Zod schema via transform |
|---|---|---|
| `trim` | `.trim()` per field | `.trim()` (Zod built-in) |
| `normalizeEmail` (lowercase) | `.normalizeEmail()` | `.toLowerCase()` (Zod) |
| `escape` (XSS) | `.escape()` per field | `.transform(escapeHtml)` — `&<>"'` → entities |
| Length/regex | `.isLength()`, `.matches()` | `.min()/.max()/.regex()` |
| Email validation | `.isEmail()` | `.pipe(z.string().email())` |

`validate` no longer checks `validationResult(req)`; single `safeParse` + `req.body = result.data` hides sanitization assignment.

## Dependency Strategy

- **In-process**: Pure computation (Zod `z`), `escapeHtml`/`normalizeEmail` helpers merged directly into module. No I/O, no injection.
- **No external deps removed from interface:** `express-validator` remains in `package.json` for deprecated `sanitize.middleware.ts` no-ops but is no longer imported by hot path (`validate` + schemas). Remove in next major.

## Testing Strategy

- **New boundary tests to write (at `validate(schema)` interface — survive refactors):**
  - `registerSchema` — `  TEST@Example.COM ` → `test@example.com` (trim+lower), `alice_123` → `alice_123`, `<script>` → `&lt;script&gt;` escaped then regex-fails (`Username can only contain letters...`), `ab` → `Username must be at least 3 characters`, `weakpass` → password regex error.
  - `loginSchema` — email vs username paths (`email` lowercased, `username` trimmed+escaped, neither → `Either email or username is required`), `  Foo@BAR.com ` + ` secret ` → sanitized.
  - `changePasswordSchema` / `resetPasswordSchema` / `updateUsernameSchema` — same trim/regex coverage, `updateUsername` `bad-name!` → regex fail.
  - `validate(registerSchema)` middleware — success assigns sanitized `req.body` (assert `req.body.email === 'test@example.com'`), failure throws `ApiError(400, 'Validation failed', [{field:'email',message}] )` with `field` join.
  - Backward compat: `sanitizeRegistration` no-op logs warning but does not throw, route still works with single `validate`.

- **Old tests to delete:** Shallow unit tests for each `sanitizeRegistration` chain (5 files) asserting `body('email').isEmail()` etc.; dual-library `validate` tests that mock `validationResult(req)` — replaced by `validate(schema)` boundary suite with Zod `safeParse`.

- **Test environment needs:** None — pure in-memory Zod. Run via `pnpm exec tsx` or `vitest` with no Redis/Postgres.

## Implementation Recommendations

**What the module should own:**
- All auth input shapes + sanitization policy (trim, normalize, escape, length, regex, email format) in one place (`validators/auth.validator.ts` + `lib/validation/index.ts` helpers). Single source for `username` regex, password policy.

**What it should hide:**
- `express-validator` chains, `body()` builder, `escape()` HTML-entity details, `validationResult` shape; callers see only `validate(schema)` and `ApiError` field errors.

**What it should expose:**
- `validate(schema: ZodType)` factory (middleware) + 8 Zod schemas + typed `RegisterInput` etc. (`z.infer`). No `sanitize*` exports (deprecated). Route middleware order becomes `validate(schema), handler` (or `verifyJWT, validate(schema), handler`).

**How callers should migrate:**
1. Drop `import { sanitize* } from '.../sanitize.middleware'` and remove `sanitize*` from route chains (already done `routes/auth/user.routes.ts:28-78`).
2. Keep `import { validate }` from `middlewares/validate.middleware` (now pure Zod) or switch to `lib/validation`.
3. If custom sanitization needed (e.g., new field), add transform in schema (`.trim().transform(...)`) not new express-validator chain.
4. Keep `sanitize.middleware.ts` until next major — it now logs `[DEPRECATED]` warning and no-ops; search `sanitize` and delete when zero imports remain, then `pnpm remove express-validator` if no other consumer.


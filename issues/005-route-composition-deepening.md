# RFC: Deepen Route Composition — Focused Modules over God-Router

## Problem

**God-router, shallow wiring** — `src/routes/auth/user.routes.ts:136` is the apex coupling point, importing everything: 4 controller modules (11 handlers across `auth.controller:7` + `password.controller:3` + `user.controller:3` + `admin.controller:1`), 5 `sanitize` chains, 7 Zod schemas, `verifyJWT`, `validate`, `passport`, `multer`, 2 `rateLimit` instances (`avatarLimiter`, `usernameUpdateLimiter`). To add one endpoint (`POST /change-password`) you touch `routes → validator → controller → sanitize` 4 files, and must know correct `sanitizePasswordChange, validate(changePasswordSchema)` order plus `verifyJWT` placement.

Shallow interface: `Router` export is trivial wiring — `Router().route('/register').post(validate(registerSchema), registerUser)` — interface equals implementation, no abstraction over auth vs profile vs admin vs OAuth concerns. `healthcheck.routes.ts:12` (trivial) vs `user.routes.ts:136` (god) asymmetry reveals no depth.

Tight coupling: `src/app.ts:82` mounts `userRouter` at `/api/v1/users` with global `authLimiter` (10/15m) conflating public auth (register/login) rate limits with authenticated profile limits; `avatarLimiter`/`usernameUpdateLimiter` co-located in god-router but owned by profile. `upload.single('avatar')` multer config inline, `passport.authenticate('google' scope: ['profile','email'])` inline. Path/name mismatch (`routes/auth/` vs `/api/v1/users`) confuses discovery. Adding `assignRole` required editing same file as `register`.

Integration risk in seams: handler not co-located with its rate limiter (`avatarLimiter` 5/15m vs global `authLimiter` 10/15m), `verifyJWT` sometimes before `multer` (`/avatar` does `avatarLimiter → upload.single → verifyJWT` — uploads before auth, waste), OAuth routes lack validation, admin lacks RBAC middleware.

## Proposed Interface

**Decomposed `src/routes/auth/*.routes.ts` — 4 focused routers (single responsibility), thin aggregator for compat, co-located middleware.**

### File topology (after)

- `src/routes/auth/auth.routes.ts:1` — public auth (6 endpoints): `POST /register`, `POST /login`, `POST /refresh-token`, `GET /verify-email/:token`, `POST /forgot-password`, `POST /reset-password/:token` — owns `registerSchema` etc., no `verifyJWT`, no `multer`.
- `src/routes/auth/profile.routes.ts:1` — authenticated profile (6 endpoints): `POST /logout`, `GET /current-user`, `PUT /username`, `POST /avatar`, `POST /change-password`, `POST /resend-email-verification` — owns `avatarLimiter`/`usernameUpdateLimiter`/`multer` (`fileSize:5MB`) co-located, not shared.
- `src/routes/auth/admin.routes.ts:1` — admin (1 endpoint): `POST /assign-role/:userId` — isolated, future RBAC `requireRole('admin')` added here without touching auth.
- `src/routes/auth/oauth.routes.ts:1` — SSO (4 endpoints): `GET /google`, `GET /github`, `GET /google/callback`, `GET /github/callback` — owns `passport.authenticate` + `handleSocialLogin`, no validation chains.
- `src/routes/auth/user.routes.ts:1` — `@deprecated` thin aggregator: `Router().use(authRoutes).use(profileRoutes).use(adminRoutes).use(oauthRoutes)` (4 sub-routers, 10 LoC, preserves `import userRouter from './routes/auth/user.routes'` path mismatch for compat).

### Public surface

```typescript
// Before god-router 116 LoC (after validation deepening) — 40 imports, multiplexed
import { Router } from 'express';
import { registerUser, loginUser, ... } from '../../controllers/auth/auth.controller';
import { forgotPasswordRequest, ... } from '../../controllers/auth/password.controller';
import { getCurrentUser, ... } from '../../controllers/auth/user.controller';
import { assignRole } from '../../controllers/auth/admin.controller';
import { verifyJWT } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { registerSchema, ... } from '../../validators/auth.validator';
import passport from 'passport';
const router = Router();
router.post('/register', validate(registerSchema), registerUser);
router.put('/username', verifyJWT, usernameUpdateLimiter, validate(updateUsernameSchema), updateUsername);
router.get('/google', passport.authenticate('google', { scope:['profile','email'] }), (req,res)=>res.send(...));
router.get('/google/callback', passport.authenticate('google'), handleSocialLogin);
// ... 12 more routes
export default router;

// After focused modules — single responsibility, co-located middleware, explicit composition
import authRoutes from './auth.routes';       //  6 endpoints, owns 4 schemas
import profileRoutes from './profile.routes'; //  6 endpoints, owns avatar/username limiters + multer
import adminRoutes from './admin.routes';     //  1 endpoint, owns assignRoleSchema
import oauthRoutes from './oauth.routes';     //  4 endpoints, owns passport
const router = Router();
router.use(authRoutes);    // /register, /login, /refresh-token, /verify-email/:token, /forgot-password, /reset-password/:token
router.use(profileRoutes); // /logout, /current-user, /username (+3/day per user), /avatar (+5/15m + 5MB), /change-password, /resend-email-verification
router.use(adminRoutes);   // /assign-role/:userId
router.use(oauthRoutes);   // /google, /github, /google/callback, /github/callback
export default router;
```

### Composition wiring — before vs after

**Before `src/app.ts:82` (single god-router):**
```typescript
import userRouter from './routes/auth/user.routes';
app.use('/api/v1/users', authLimiter, userRouter);
```

**After (explicit wiring, preferred for new code):**
```typescript
import authRoutes from './routes/auth/auth.routes';
import profileRoutes from './routes/auth/profile.routes';
import adminRoutes from './routes/auth/admin.routes';
import oauthRoutes from './routes/auth/oauth.routes';
app.use('/api/v1/users', authLimiter, authRoutes); // authLimiter only on public auth (register/login), not profile
app.use('/api/v1/users', profileRoutes);             // profile owns its limiters (avatar 5/15m, username 3/day per user)
app.use('/api/v1/users', adminRoutes);
app.use('/api/v1/users', oauthRoutes);
// or keep aggregator for compat: import userRouter from './routes/auth/user.routes'; app.use('/api/v1/users', authLimiter, userRouter);
```

### What it hides internally

| Hidden | Previously in god-router | Now co-located in focused module |
|---|---|---|
| Public auth validation | `validate(registerSchema)` mixed with `verifyJWT`/`multer` | `auth.routes.ts` owns only 4 schemas, no auth guard |
| Profile rate limits + upload | `avatarLimiter`/`usernameUpdateLimiter`/`multer({limit:5MB})` shared in god-router | `profile.routes.ts` owns all three, `usernameUpdateLimiter` `keyGenerator: user.id || ipKeyGenerator(req.ip)` isolated |
| Admin guard | `assignRole` alongside `register` | `admin.routes.ts` isolated, `verifyJWT` + `validate(assignRoleSchema)` only |
| OAuth passport wiring | `passport.authenticate('google', scope:['profile','email'])` inline 4 handlers | `oauth.routes.ts` owns all 4 `passport.authenticate` + `handleSocialLogin`, no validation |
| Path mismatch | `src/routes/auth/` vs `/api/v1/users` hidden | Aggregator `user.routes.ts:8` notes mismatch in header comment; split count `auth 6 + profile 6 + admin 1 + oauth 4 = 17` endpoints now auditable per file |

## Dependency Strategy

- **In-process**: Pure composition (Express `Router().use`), no I/O. Profile's `multer`/`rateLimit` are in-process middleware but co-located per domain, not shared globals. No port needed.
- **No external deps:** Route modules still `import` controllers/validators directly (shallow handlers will be replaced by `AuthDomain` facade `createAuth().router` in auth-domain RFC, eventually removing controller imports).

## Testing Strategy

- **New boundary tests to write (at decomposed router interface — survive internal moves):**
  - `auth.routes` — `POST /register` with sanitized email `  TEST@Example.COM` → `201`, `POST /login` with `email` vs `username` variants (from loginSchema refine), `POST /forgot-password` missing `email` → `400 Validation failed`, `POST /reset-password/:token` weak password → `400`.
  - `profile.routes` — `PUT /username` 4th request within 24h → `429 Too many username updates` (usernameUpdateLimiter per user), `POST /avatar` without `verifyJWT` → `401`, with valid token but `fileSize >5MB` → `400`, with `verifyJWT` + valid `image/png` → `200 profilePicture`.
  - `admin.routes` — `POST /assign-role/:userId` without `verifyJWT` → `401`, with `role:'superadmin'` → `400 Role must be either 'admin' or 'user'`.
  - `oauth.routes` — `GET /google` → `302` to Google (or `200 redirecting to google...` stub), `GET /google/callback` with `passport.authenticate('google')` mock → calls `handleSocialLogin`.
  - Aggregator — `user.routes` `Router().use(authRoutes).use(profileRoutes)...` still mounts all 17 endpoints at `/api/v1/users` (supertest on `makeApp()` hits `GET /api/v1/users/verify-email/:token` via auth sub-router).
  - `app.ts` wiring — `makeApp()` mounts `healthcheck` + `users` (or 4 decomposed) without doubling handlers; `authLimiter` (10/15m) only on `authRoutes`, not `profileRoutes`.

- **Old tests to delete:** Per `replace, don't layer` — delete god-router `user.routes` integration tests mocking 11 handlers + 7 schemas in one 136 LoC suite; replace with per-focused-module contract tests (6/6/1/4 endpoints). Keep only `makeApp` mount test.

- **Test environment needs:** `supertest` + `makeApp()` (from `src/app.ts:15`), `getAuth()` InMemory `UserRepository` stub for `verifyJWT` (or `FakeTokenSigner` for `AuthDomain`), no Postgres/Redis. `multer` tested via `attach('avatar', Buffer)` without S3.

## Implementation Recommendations

**What the module should own:**
- Auth lifecycle routes (public, no `verifyJWT`, owns 4 Zod schemas), profile routes (all `verifyJWT`, owns avatar/username limiters + multer), admin routes (single, future `requireRole`), OAuth routes (passport). Each router is `Router()` with `6/6/1/4` endpoints, not one 17-endpoint god-router.

**What it should hide:**
- Rate limit configs (`windowMs`, `max`, `keyGenerator`), `multer` `fileSize`, `passport` `scope` — co-located per domain, not in `app.ts`. `sanitize` chains already hidden (validation RFC).

**What it should expose:**
- 4 focused `Router` exports (`auth.routes`, `profile.routes`, `admin.routes`, `oauth.routes`) + deprecated `user.routes` aggregator (`Router().use(...)` 4 lines). `app.ts` mounts aggregator for compat or 4 routers explicitly.

**How callers should migrate:**
1. **Phase 0 (done):** Focused modules `src/routes/auth/{auth,profile,admin,oauth}.routes.ts` created (6/6/1/4 endpoints), `src/routes/auth/user.routes.ts:1` now thin aggregator (`Router().use` 4) with `@deprecated` comment noting `auth/` vs `/api/v1/users` mismatch.
2. **Phase 1:** New endpoints added in focused file (e.g., `POST /change-email` → `profile.routes.ts`), not `user.routes.ts`; `admin` RBAC `requireRole('admin')` added only in `admin.routes.ts`.
3. **Phase 2:** `src/app.ts:82` optionally split `app.use('/api/v1/users', authLimiter, userRouter)` into 4 mounts (explicit limiter per domain); keep aggregator until `user.routes.ts` zero imports remain, then delete aggregator and mount decomposed directly.
4. **Phase 3:** When `AuthDomain` facade `createAuth().router` lands, replace `auth.routes.ts` controller imports (`registerUser` etc.) with `authDomain` calls (`validate(registerSchema)` stays, handler becomes `(req,res)=>res.json(await auth.register(req.body))`); profile/oauth/admin follow.


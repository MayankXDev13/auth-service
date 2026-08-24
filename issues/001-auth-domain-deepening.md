# RFC: Deepen Auth Domain — Ergonomic Facade over Ports & Adapters

## Problem

**Shallow modules, tightly coupled, integration risk in the seams** — `src/controllers/auth/auth.controller.ts:483` (7 handlers + `generateAccessAndRefreshToken:21` + `generateTemporaryToken:69`), `password.controller.ts:194` (3 handlers + duplicate `generateTemporaryToken:181`), `user.controller.ts:157` (3 handlers + phantom `utils/cache:11`), `admin.controller.ts:46`, plus `middlewares/auth.middleware.ts:10` (`verifyJWT`), `utils/token.ts:3` (`hashToken` unused), and `passport/index.ts:311` (Google/GitHub 85 LoC duplication, side-effect `import './passport/index'` in `app.ts:10`) are all shallow procedural handlers. Understanding one flow (`registerUser:88`) requires bouncing 6 files: `routes/auth/user.routes.ts:66` → `sanitize.middleware.ts:6` → `validators/auth.validator.ts:3` → `auth.controller.ts:88` → `utils/mail.ts:23` (`Resend`+`Mailgen`) → `lib/posthog.ts:3` plus `config/env.ts:52` vs 8 direct `process.env.*` bypasses (`mail.ts:5,15`, `posthog.ts:3` `!` assert, `app.ts:47`, `user.controller.ts:115`).

Tightly-coupled seams where real bugs hide:
- `generateTemporaryToken` duplicated identically in `auth.controller.ts:69` and `password.controller.ts:181` (20m expiry hardcoded both); `hashToken` in `utils/token.ts:3` unused while `crypto.createHash('sha256')` is inlined 5× (`auth.controller.ts:72,271`, `password.controller.ts:84`).
- `refreshAccessToken:406` does `await db.update(User).set({refreshToken: newRefreshToken})` **without `.where()`** — silently updates all rows; hidden between `auth.middleware.ts:21` JWT verify and controller.
- `user.controller.ts:23` `getCurrentUser` caches 1800s via `getCachedUser/cacheUser` but `updateUsername`/`uploadProfilePicture` never invalidate; phantom `src/utils/cache.ts` and `src/lib/redis.ts` missing from `src/` but alive in `dist/` (`dist/utils/cache.js:138`, `dist/lib/redis.js:58`), `server.ts:7` never calls `initRedis()`, `queues/queues.ts:3` `new Queue('emailQueue')` has no connection.
- 13 inline `posthog.capture` calls (`auth.controller.ts:133,199,248...`), `app.ts:47` CORS origin via `process.env.ALLOWED_ORIGINS`, `mail.ts:5` throws at import if `RESEND_API_KEY` missing — all singletons constructed at module load, untestable without live PG+Redis+Resend+PostHog+S3.
- Routes god-file `routes/auth/user.routes.ts:136` multiplexes 4 controller modules, 5 sanitize chains, 7 Zod schemas, `verifyJWT`, `multer`, 2 `rateLimit` instances — change any validator requires editing routes + controller + sanitize + validator.

Result: **0 tests, no test infra** (`package.json` has no `test` script), every handler mixes `db.query` + `bcrypt` + `jwt` + `crypto` + `sendEmail` + `posthog` inline. Deep module needed to hide this complexity behind a small, testable boundary.

## Proposed Interface

**Hybrid A:** Public ergonomic facade (Agent 3) layered over ports & adapters internals (Agent 4). Hot path callers see trivial `register/login/authenticate/me + router`; internals use explicit ports + lifecycle.

### Public surface — `src/modules/auth/index.ts`

```typescript
// Factory — all options optional, defaults from env.ts single parse
export function createAuth(opts?: AuthOptions): Auth;

export type AuthOptions = {
  db?: DrizzleClient; // default: import {db} from '@/config/db'
  cache?: CachePort;  // default: IORedisCacheAdapter(env.REDIS_URL) fallback InMemory
  mailer?: EmailPort;
  analytics?: AnalyticsPort;
  storage?: ObjectStoragePort;
  config?: AuthConfig; // default: envSchema.parse(process.env)
  jwt?: { accessSecret?: string; refreshSecret?: string; accessExpiry?: string; refreshExpiry?: string };
  baseUrl?: string;   // for verification URLs, default req-derived or env.CLIENT_SSO_REDIRECT_URL
};

export interface Auth {
  // 90% hot path — 4 methods cover 70% usage
  register(input: { email: string; username: string; password: string; origin?: string }): Promise<{ userId: string }>;
  login(input: { email?: string; username?: string; password: string }): Promise<{ user: AuthenticatedUser; tokens: Tokens }>;
  authenticate(token: string): Promise<AuthenticatedUser>;
  me(userId: string): Promise<AuthenticatedUser>; // read-through cache 30m hidden

  readonly middleware: { authenticate: RequestHandler }; // drop-in for verifyJWT
  readonly router: Router; // pre-wired: /register /login /refresh-token /verify-email/:token /logout /me

  // lifecycle — fixes server.ts never calling initRedis / queue connection
  init(): Promise<void>;
  close(): Promise<void>;

  // rare flows — explicit cost via extended, lazily loads S3/passport/multer
  readonly extended: {
    email: { verify(token: string): Promise<{ isEmailVerified: true }>; resend(userId: string, origin?: string): Promise<void> };
    password: { forgot(email: string): Promise<void>; reset(token: string, newPassword: string): Promise<void>; change(userId: string, oldPassword: string, newPassword: string): Promise<void> };
    profile: { updateUsername(userId: string, username: string): Promise<{ username: string }>; uploadAvatar(userId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<{ profilePicture: string }> };
    tokens: { refresh(refreshToken: string): Promise<Tokens> };
    admin: { assignRole(actorId: string, targetUserId: string, role: 'admin'|'user'): Promise<void> };
    oauth: { router: Router }; // /google, /github, callbacks — hides passport
    logout(userId: string): Promise<void>;
  };
}

// Example domain types
export type AuthenticatedUser = { id: string; email: string; username: string; role: 'admin'|'user'; profilePicture: string|null; isEmailVerified: boolean };
export type Tokens = { accessToken: string; refreshToken: string };
```

### Internal ports — `src/modules/auth/ports.ts` (no concrete imports)

```typescript
export interface UserRepository { findById(id:string):Promise<User|null>; findByEmail(email:string):Promise<User|null>; findUniqueByEmailOrUsername(email:string, username:string):Promise<User|null>; findByVerificationToken(hashed:string):Promise<User|null>; findByForgotToken(hashed:string):Promise<User|null>; create(data:CreateUserInput):Promise<User>; update(id:string,patch:Partial<User>):Promise<User>; }
export interface EmailPort { send(opts:{to:string;subject:string;html:string;text:string}):Promise<{id:string}>; }
export interface CachePort { get<T>(k:string):Promise<T|null>; setex<T>(k:string,ttl:number,v:T):Promise<void>; del(k:string):Promise<void>; }
export interface ObjectStoragePort { upload(key:string,body:Buffer,ct:string):Promise<{url:string}>; delete(key:string):Promise<void>; }
export interface AnalyticsPort { capture(e:{distinctId:string;event:string;properties?:object}):void; flush?():Promise<void>; shutdown?():Promise<void>; }
export interface TokenSigner { signAccessToken(p:JwtPayload):string; signRefreshToken(p:{userId:string}):string; verifyRefreshToken(t:string):{userId:string}; }
export interface Clock { now():Date; }
export interface PasswordHasher { hash(pw:string):Promise<string>; compare(pw:string,hash:string):Promise<boolean>; }
export type AuthConfig = { accessTokenSecret:string; refreshTokenSecret:string; accessTokenExpiry:string; refreshTokenExpiry:string; clientSsoRedirectUrl:string; forgotPasswordRedirectUrl:string; s3Bucket:string; s3Region:string; s3ProfilePicsPrefix:string };
export type AuthPorts = { users:UserRepository; email:EmailPort; cache:CachePort; storage:ObjectStoragePort; analytics:AnalyticsPort; tokens:TokenSigner; hasher:PasswordHasher; clock:Clock };
```

### Usage example — before vs after

**Before — `routes/auth/user.routes.ts:66` today (8 imports, manual sanitize+validate+handler):**
```typescript
import { registerUser } from '../../controllers/auth/auth.controller';
import { sanitizeRegistration } from '../../middlewares/sanitize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { registerSchema } from '../../validators/auth.validator';
router.post('/register', sanitizeRegistration, validate(registerSchema), registerUser);
```

**After — hot path trivial (no plumbing imports):**
```typescript
// src/app.ts / src/server.ts — explicit bootstrap, single env parse
import { createAuth } from '@/modules/auth';
import { env } from '@/config/env';
export const auth = createAuth(); // or createAuth({ db, cache, mailer }) for tests
await auth.init();
app.use('/api/v1/users', auth.router); // mounts register/login/verify-email/refresh/logout/me + middleware

// Service-level (non-HTTP) — e.g., queue job, script
await auth.register({ email:'a@b.com', username:'alice', password:'Str0ng!Pass1@' });
const { user, tokens } = await auth.login({ email:'a@b.com', password:'Str0ng!Pass1@' });
await auth.me(user.id);

// Rare — explicit via extended
await auth.extended.password.forgot('a@b.com');
await auth.extended.profile.uploadAvatar(user.id, { buffer, mimetype:'image/png', originalname:'pic.png' });
app.use('/api/v1/users', auth.extended.oauth.router);
```

### What complexity it hides internally
- **Token lifecycle:** Single canonical `hashToken` (`utils/token.ts:3`), `generateTemporaryToken` (randomBytes 32 → sha256 + 20m expiry) unified, fixes `refreshAccessToken:406` missing `where` — rotation + reuse detection (`incoming !== stored → 401`) centralized in `TokenSigner` + `Clock` for deterministic expiry tests.
- **Validation+sanitization:** `registerSchema` + `sanitizeRegistration` run inside `register()` — caller never imports `validate.ts:6` or `sanitize.middleware.ts:6`; throws typed `AuthError` mapped to `ApiError` at HTTP edge.
- **DB/Repository:** `UserRepository` owns all 15 cols of `db/schema/user.ts:11` + Drizzle operators (`eq,or,and,gt`) — no caller touches Drizzle.
- **Cache/storage coherence:** `me()` read-through `get→db→setex(1800)` hidden; `updateUsername`/`uploadProfilePicture` invalidate cache; S3 key `s3ProfilePicsPrefix + userId + sanitizedName + Date.now()` + old avatar GC + `image/*` + 5MB validation hidden in `S3StorageAdapter`.
- **Mail/analytics:** `Mailer` renders `Mailgen` inside adapter; `AnalyticsPort` centralizes 13 `posthog.capture` events to one enum, fire-and-forget with `flush` on `close()`.
- **OAuth:** `passport/index.ts:125,218` Google vs GitHub duplication (`sub` vs `node_id`, `picture` vs `avatar_url`) hidden behind `OAuthPort`; adding Apple = new adapter.
- **Env/lifecycle:** One `envSchema.parse` → `AuthConfig` value object; `init()` connects PG/Redis/S3, verifies bucket, warms queue; `close()` drains `pool.end()`, `redis.quit()`, `queue.close()`, `analytics.flush()`.

## Dependency Strategy

| Dependency | Category | Port | Production Adapter | Test Adapter |
|---|---|---|---|---|
| `crypto`/`bcrypt`/`jwt`/`hashToken` | **1. In-process** | None (merged) — optional `Clock`/`Hasher`/`TokenSigner` ports for determinism/speed | Direct `node:crypto`, `bcrypt`, `jsonwebtoken` | `FakeHasher` (`hashed:${pw}`), `FakeTokenSigner` (sync), `Clock` fixed date, deterministic `IdGenerator` |
| Postgres + Drizzle (`config/db.ts:7` Pool) | **2. Local-substitutable** | `UserRepository` | `DrizzleUserRepository(pool: Pool)` — `init()` does `SELECT 1`, `close()` calls `pool.end()` | PGlite (`@electric-sql/pglite` + `drizzle-orm/pglite`) for SQL fidelity, or `InMemoryUserRepository` (Map) for speed |
| Redis/Cache (`dist/lib/redis.js` + `dist/utils/cache.js`) | **2. Local-substitutable** | `CachePort` | `IORedisCacheAdapter(env.REDIS_URL)` — throws if missing (fails fast vs current silent null) | `InMemoryCacheAdapter` — `Map<string,{value,expiresAt}>` respecting `ttlSec` via `Clock` |
| S3 (`utils/s3.ts:8`) | **2. Local-substitutable** | `ObjectStoragePort` | `S3StorageAdapter` | `InMemoryStorageAdapter` (Map) — returns `memory://bucket/key` |
| BullMQ (`queues/queues.ts:3` bare `new Queue`) | **2. Local-substitutable** | `QueuePort` | `BullMQQueueAdapter(connection: IORedis)` | `InMemoryQueueAdapter` (array + immediate callback) |
| Resend+Mailgen (`utils/mail.ts:2`) | **4. True external (Mock)** | `EmailPort` | `ResendEmailAdapter` — hides `mailGenerator.generate`, 3× retry with backoff | `InMemoryEmailAdapter` (`sent[]` + `assertSent`) or `vi.fn()` mock |
| PostHog (`lib/posthog.ts:3`) | **4. True external (Mock)** | `AnalyticsPort` | `PostHogAnalyticsAdapter` — no-ops if `POSTHOG_API_KEY` undefined (fixes `!` crash) | `NoopAnalytics` or `vi.fn()` asserting `capture({event:'user_registered'})` |
| OAuth providers (`passport-*`) | **4. True external (Mock)** | `OAuthPort` (inside `AuthDomain`) | `PassportOAuthAdapter` — registers strategies in `init()`, not at import time | `FakeOAuthAdapter` returning canned `User` |

No **3. Remote but owned** dependencies today; if auth splits to RPC, add `UserServicePort` with `Http` vs `InMemory` adapters without changing domain.

## Testing Strategy

- **New boundary tests to write (at `Auth` / `AuthDomain` interface — survive refactors, assert observable outcomes):**
  - `register → verify → login → refresh → logout` happy path (assert `email.sent[0].to`, `users.findByEmail` exists, `analytics capture user_registered`, tokens returned, cookies set).
  - Duplicate `register` with same email/username → `409 User exists` (covers `or(eq(email),eq(username))`).
  - `verifyEmail` with expired token (advance `Clock` +20m) → `400 Token invalid or expired`; valid → `isEmailVerified:true` + token nulled.
  - `login` via email vs username (both `loginSchema` paths), wrong password → `401 Invalid credentials`.
  - `authenticate` valid/expired/missing → `401 Access token expired / Invalid token` (replaces `verifyJWT`).
  - `refresh` rotation — valid token rotates and invalidates old; reuse of old token → `401 expired or used`; regression for missing `where` bug (assert other users' `refreshToken` unchanged).
  - `forgot → reset` — full flow, same-password guard `400 New password cannot be same`, expired `forgotToken` expiry.
  - `changeCurrentPassword` wrong oldPassword → `401`.
  - `me()` read-through: first call misses cache → hits `UserRepository`, second hits `CachePort` (spy repo not called); TTL 1800 respected via `Clock`.
  - `updateUsername` collision → `409`, `uploadProfilePicture` `text/csv` → `400 Invalid file type`, >5MB → `400`, valid `image/png` → storage upload + old avatar delete + DB update.
  - OAuth `handleSocialLogin` new Google/Github user created `isEmailVerified:true`, existing email with `loginType=email_password` → `400 Please use that login method`.
  - Lifecycle: `init()` without `REDIS_URL` throws, `close()` drains handles without leak.

- **Old tests to delete (replace, don't layer):**
  - Shallow per-handler mocks of `db.query.User.findFirst` in `auth.controller.ts:88` / `password.controller.ts:21`, `verifyJWT` isolated tests, `sanitizeRegistration` / `validate(registerSchema)` unit tests, `passport` strategy stubs of `db.select().from(User)`. All become redundant once boundary suite covers domain via ports. Keep only narrow adapter contract tests (e.g., `ResendEmailAdapter` retries once on 429, `S3StorageAdapter` key sanitization).

- **Test environment needs:**
  - PGlite (`@electric-sql/pglite` + `drizzle-orm/pglite`) or `InMemory*` adapters (50 LoC each in `src/modules/auth/adapters/__test__/`) — no Docker. `InMemoryCacheAdapter` + `InMemoryStorageAdapter` + `InMemoryEmailAdapter` + `NoopAnalytics` + `FakeHasher` (avoids bcrypt 12-round cost). One suite still exercises real `bcrypt`/`jwt` for integration confidence. No live Resend/PostHog/S3/Redis required. CI runs `pnpm test` with zero `.env`.

## Implementation Recommendations

**What the module should own:**
- Auth invariants: password policy (Zod regex `/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/`), bcrypt cost 12, token hash+expiry (20m), `isEmailVerified`/`isActive` checks, `loginType` guard, refresh rotation + reuse detection, cache TTL 1800, S3 key sanitization, `lastLoginAt` update. Single `AuthError` union → `ApiError` mapping at edge.

**What it should hide:**
- Vendor SDKs (`pg`, `ioredis`, `@aws-sdk/client-s3`, `resend`, `posthog-node`, `passport-*`, `mailgen`), retry/backoff, SQL dialect, cache JSON serialization, URL construction (`${protocol}://${host}/verify-email/...` behind `baseUrl`), queue transport, 13 `posthog.capture` call-sites, sanitization (`express-validator`).

**What it should expose:**
- `createAuth(opts?) → Auth` (ergonomic public API) + `AuthError` + `AuthenticatedUser`/`Tokens`. `createAuthDomain(config, ports)` is internal. Controllers become 5-line HTTP translators: `const r = await auth.register(req.body); res.status(201).json(new ApiResponse(201,r,'...'))`. `passport` is not a global singleton.

**How callers should migrate:**
1. **Phase 0 — bootstrap:** Create `src/modules/auth/ports.ts`, `domain.ts`, `index.ts` (facade). Implement adapters wrapping current `dist/lib/redis.js`/`dist/utils/cache.js` code but with injected config. Add `src/bootstrap.ts` that parses `env.ts` once, creates adapters, `await auth.init()`, wires `makeApp(auth)`. Update `server.ts:7` to `await bootstrap()` before `listen`. Keep old code under feature flag.
2. **Phase 1 — passport:** Change `src/app.ts:10` `import './passport/index'` side-effect → `auth.init()` registers strategies via `PassportOAuthAdapter`. Export `createPassportStrategies(ports)` called by domain.
3. **Phase 2 — routes:** Replace `routes/auth/user.routes.ts:136` god-router with `auth.router` + `auth.extended.oauth.router` + `auth.middleware.authenticate`. Move `avatarLimiter`/`usernameUpdateLimiter` into `extended` adapters. Mount via `app.use('/api/v1/users', auth.router)`.
4. **Phase 3 — controllers:** Migrate handlers one flow at a time behind flag; copy queries into `DrizzleUserRepository` (dedupe `generateTemporaryToken` + fix `406` missing `where`). Delete `src/controllers/auth/*` when boundary suite green.
5. **Phase 4 — infra:** Delete phantom `dist/utils/cache.js`/`dist/lib/redis.js` sources moved to `src/modules/auth/adapters/`. Enforce via `eslint` `no-restricted-imports` banning `import {db} from '@/config/db'` etc. inside `src/modules/auth` except adapters.
6. **Phase 5 — validation:** Consolidate `sanitize.middleware.ts:6` + `validators/auth.validator.ts:3` + `validate.middleware.ts:6` into domain-internal Zod validation (remove `express-validator`).

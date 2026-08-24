# RFC: Deepen Passport OAuth — Explicit Factory over Side-Effect

## Problem

**Side-effect, duplicated, untestable** — `src/passport/index.ts:311` is a side-effect module executed via `import './passport/index'` in `src/app.ts:10`. It registers 3 strategies (`LocalStrategy:69`, `GoogleStrategy:131`, `GitHubStrategy:224`) on the global `passport` singleton at import time, with conditional `if (env.GOOGLE_CLIENT_ID...)` guards. `Google` and `GitHub` verify callbacks are 85 LoC each, 70% duplicated except 2 fields (`profile._json.sub/picture` vs `node_id/avatar_url`) and event name. Both do: `find by email → if exists check loginType → else insert {email, password: sub/node_id, username: email.split('@')[0], isEmailVerified:true, profilePicture}`. Duplication hides subtle drift (password stores provider sub vs node_id, picture vs avatar_url).

Tight coupling: every branch imports concrete `db` (`db.select().from(User).where(eq(User.email))`), `env`, `posthog`, `bcrypt`, `logger`. `serializeUser/deserializeUser` use `any` and `ApiError`, `deserializeUser` does `db.select().from(User)` not `UserRepository`. Order-dependent global mutation — `app.ts` must import before `passport.authenticate('google')` in `routes/auth/user.routes.ts:110`, but no explicit `initPassport()` call. Tests require live Postgres + env with real `GOOGLE_CLIENT_ID` etc.; InMemory path impossible.

Shallow module: interface is global side-effect (`import` registers), implementation is 311 LoC procedural duplication. `loginType` guard (`if user.loginType !== 'google' → 400`) hidden in seam between OAuth and email_password flows, integration risk if someone changes `User` schema.

## Proposed Interface

**Deep module `src/modules/auth/passport/factory.ts` — explicit factory `createPassportStrategies({ passport, users, config, analytics, hasher, env })` hides vendor differences.**

### Public surface

```typescript
// src/modules/auth/passport/factory.ts
type Deps = {
  passport: PassportStatic;
  users: UserRepository;        // 2. Local-substitutable (PGlite/InMemory)
  config: AuthConfig;           // 1. In-process value
  analytics: AnalyticsPort;     // 4. True external mock
  hasher: PasswordHasher;
  env: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; GOOGLE_CALLBACK_URL?: string;
         GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string; GITHUB_CALLBACK_URL?: string; };
};

export function createPassportStrategies(deps: Deps): PassportStatic;

// Single deduplicated OAuth verify factory hidden internally:
async function createOAuthVerify(profile: any, provider: 'google'|'github', deps: Deps, done: Function);
// Normalizes vendor shape → { email, providerId, avatarUrl, provider } then:
// findByEmail → if exists check loginType guard → else create { email, password: providerId, username: email.split('@')[0], ... }
```

### Usage — before vs after

**Before `src/passport/index.ts:1` (side-effect, concrete imports):**
```typescript
import passport from 'passport';
import { env } from '../config/env';
import { db } from '../config/db';
passport.serializeUser((user:any, next)=> next(null, user.id));
passport.deserializeUser(async (id, next)=> { const [u] = await db.select().from(User).where(eq(User.id,id)); ... });
passport.use(new LocalStrategy({ usernameField:'username' }, async (username, password, next)=> {
  const [u] = await db.select().from(User).where(or(eq(User.email,username),eq(User.username,username)));
  if (!await bcrypt.compare(password, u.password)) return next(new ApiError(401,'Invalid credentials'));
}));
if (env.GOOGLE_CLIENT_ID) passport.use(new GoogleStrategy({ clientID: env.GOOGLE_CLIENT_ID, ... }, async (_,__, profile, next)=> {
  const [u] = await db.select().from(User).where(eq(User.email, profile._json.email));
  if (u && u.loginType !== 'google') return next(new ApiError(400, `You registered using ${u.loginType}...`));
  if (!u) await db.insert(User).values({ email: profile._json.email, password: profile._json.sub, ... });
}));
if (env.GITHUB_CLIENT_ID) passport.use(new GitHubStrategy({ ... }, async (_,__, profile, next)=> {
  // 85 LoC duplicate of Google except node_id/avatar_url
}));
```
**Problems:** Duplication, `import './passport/index'` order, `env` vs `process.env` bypass, `posthog` non-null assert, `bcrypt` hard-coded.

**After `src/modules/auth/passport/factory.ts:1` + `bootstrap.ts:38`:**
```typescript
// src/modules/auth/passport/factory.ts — deep module, owns OAuth strategy creation
import { createPassportStrategies } from './modules/auth/passport/factory';
import { DrizzleUserRepository } from './modules/auth/adapters/drizzleUserRepository';
const users = new DrizzleUserRepository(db);
createPassportStrategies({
  passport,
  users,
  config: { accessTokenSecret: env.ACCESS_TOKEN_SECRET, ... },
  analytics: { capture: (e)=> posthog?.capture(e) },
  hasher: { hash: (pw)=> bcrypt.hash(pw,12), compare: bcrypt.compare },
  env, // optional Google/GitHub keys
});

// Test — InMemory, no DB, deterministic
const passportTest = new Passport();
const usersMem = new InMemoryUserRepository();
createPassportStrategies({
  passport: passportTest,
  users: usersMem as any,
  config: fakeConfig,
  analytics: { capture: vi.fn() },
  hasher: { hash: async(pw)=>`hashed:${pw}`, compare: async(pw,hash)=>hash===`hashed:${pw}` },
  env: { GOOGLE_CLIENT_ID:'id', GOOGLE_CLIENT_SECRET:'sec', GOOGLE_CALLBACK_URL:'http://localhost/cb' }
});
const strategy = (passportTest as any)._strategy('google');
await new Promise((res,rej)=> strategy._verify(null,null,{_json:{email:'a@b.com', sub:'sub123', picture:'http://pic'}}, (err,user)=> err?rej(err):res(user)));
expect(usersMem.all[0].loginType).toBe('google');
```

**Production wiring `src/passport/index.ts:1` now thin wrapper for backward compat:**
```typescript
// src/passport/index.ts — @deprecated side-effect delegates to deep factory
import { createPassportStrategies } from '../modules/auth/passport/factory';
const users = new DrizzleUserRepository(db);
createPassportStrategies({ passport, users, config, analytics, hasher, env });
export default passport;
```
`src/app.ts:10` retains `import './passport/index'` for apps without `bootstrap`, but `src/bootstrap.ts:42` explicitly calls factory (idempotent, overrides side-effect with injected deps).

### What it hides internally

| Hidden | Previously scattered in `src/passport/index.ts:69,131,224` | Now inside `createOAuthVerify` |
|---|---|---|
| Vendor shape normalization | Google `profile._json.sub`/`picture` vs GitHub `node_id`/`avatar_url` duplicated 85 LoC each | Single `normalized: { email, providerId, avatarUrl, provider }` branch |
| `loginType` guard | `if (user.loginType !== 'google') return next(new ApiError(400, ...))` duplicated | Single `if (existing.loginType !== provider)` |
| User creation | `db.insert(User).values({ email: profile._json.email!, password: profile._json.sub!, username: email.split('@')[0], ... })` duplicated | Single `users.create({ email: normalized.email, password: normalized.providerId, username: email.split('@')[0], ... })` |
| `serialize/deserialize` DB access | `db.select().from(User)` concrete Drizzle, `any` | Via `UserRepository.findById` (PGlite/InMemory in tests) |
| Password hashing | `bcrypt.compare` hard-coded | Injected `PasswordHasher` (fast `hashed:${pw}` in tests) |
| Analytics | `posthog.capture` inline 2× | Injected `AnalyticsPort` (spy in tests) |

## Dependency Strategy

- **1. In-process (strategy registration):** `passport` singleton mutation (`passport.use`, `serializeUser`) merged into factory; no port, but explicit `passport` arg makes init order visible (vs side-effect import).
- **2. Local-substitutable (Postgres):** `UserRepository` → prod `DrizzleUserRepository(db)` (real Pool), test `InMemoryUserRepository` or `PGlite` with same Drizzle operators (`eq`, `or`). Factory `deserializeUser` and `LocalStrategy` use `users.findById/findByEmailOrUsername` — no `db` import inside factory.
- **4. True external (OAuth provider — mock):** `profile._json` is vendor payload mock in tests (`{email, sub/picture}` or `{email, node_id/avatar_url}`); factory hides profile shape, tests pass canned profile. No live Google/GitHub.

## Testing Strategy

- **New boundary tests to write (at factory interface — survive refactors, assert observable):**
  - `createPassportStrategies` with `InMemoryUserRepository` → `passport._strategies` contains `local` always, `google` only if `env.GOOGLE_*` present, `github` only if `env.GITHUB_*` present.
  - `LocalStrategy` — valid email/username + password via `hasher.compare` → user; inactive `isActive:false` → `401 Account is deactivated`; wrong password → `401 Invalid credentials`.
  - `serializeUser/deserializeUser` — `serializeUser({id})` → `id`, `deserializeUser(id)` → user via `users.findById`, missing → `404 User does not exist`.
  - `Google OAuth` — first callback `newgoogle@example.com` → creates `loginType:'google'`, `isEmailVerified:true`, `username: email.split('@')[0]`, `analytics capture user_registered`; second callback same email → returns existing; mismatch (`existing loginType: 'email_password'`) → `400 You registered using email_password...`.
  - `GitHub OAuth` — same as Google but `node_id/avatar_url` mapping; `github` with `google` email → `400` guard.
  - Backward compat — `import '../passport/index'` still registers strategies (thin wrapper delegates to factory), `app.ts:10` side-effect not broken.

- **Old tests to delete:** Shallow controller-style tests mocking `db.select().from(User)` per strategy, duplicating Google vs GitHub 85 LoC each — replaced by `createPassportStrategies` boundary suite with `InMemoryUserRepository` + profile fakes.

- **Test environment needs:** `InMemoryUserRepository` (50 LoC) + `FakeHasher` (no bcrypt cost) + `Passport()` fresh instance per test (instead of global singleton); no live Postgres/Redis/OAuth. Optional PGlite for SQL parity.

## Implementation Recommendations

**What the module should own:**
- Passport lifecycle: `serializeUser` (id only), `deserializeUser` (via `UserRepository`), `LocalStrategy` (email|username + `isActive` + `hasher.compare`), `GoogleStrategy` + `GitHubStrategy` via single `createOAuthVerify` (normalizes profile, checks `loginType`, creates user, `analytics capture`).

**What it should hide:**
- Drizzle `db`/`eq`/`or`, `bcrypt` rounds, `passport-google-oauth20`/`passport-github2` `Strategy` constructors, vendor JSON shapes (`_json.sub` vs `node_id`, `picture` vs `avatar_url`), `ApiError` mapping, `logger` calls. Domain error types at `done(new ApiError(...))`.

**What it should expose:**
- `createPassportStrategies(deps): PassportStatic` — sole public entry. `Deps` value object `AuthConfig` + `UserRepository` + `PasswordHasher` + `AnalyticsPort` + `env` subset.

**How callers should migrate:**
1. **Phase 0 (done):** Deep module `src/modules/auth/passport/factory.ts` with deduplicated `createOAuthVerify`; `src/passport/index.ts:1` now thin `@deprecated` wrapper calling factory with `DrizzleUserRepository` for backward compat (`app.ts:10` side-effect still works).
2. **Phase 1:** `src/bootstrap.ts:42` explicitly calls `createPassportStrategies` with shared `DrizzleUserRepository(db)` and injected `hasher`/`analytics` (non-null-safe `posthog` dummy, `bcrypt`), making init order explicit and testable; side-effect import becomes no-op on second call (idempotent `passport.use`).
3. **Phase 2:** Migrate tests to `new Passport()` + `InMemoryUserRepository` + `createPassportStrategies` (see `factory.ts` OAuth smoke); delete tests that `vi.mock('../config/db')`.
4. **Phase 3:** Add new provider (Apple) by adding `createOAuthVerify` branch `provider === 'apple'` with `{email, providerId: sub, avatarUrl}` mapping + `if (env.APPLE_*) passport.use(new AppleStrategy(...))` — no duplication.


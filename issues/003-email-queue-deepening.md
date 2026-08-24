# RFC: Deepen Email Delivery — Queued Port over Direct Send

## Problem

**Shallow, disconnected, and blocking** — `utils/mail.ts:121` owns `Resend` + `Mailgen` singleton (bypasses `env.ts` via `process.env` checks, throws at import), `queues/queues.ts:3` is `new Queue('emailQueue')` with no connection (implicit `localhost:6379`), `queues/workers.ts:10` is `new Worker('emailQueue', async job=>console.log(job.data))` stub with no email logic, run via separate `pnpm worker` script not wired to app lifecycle. Controllers still do `await sendEmail(...)` synchronously (`auth.controller.ts:119` `emailVerificationMailgenContent`, `password.controller.ts:43` `forgotPasswordMailgenContent`) — blocking HTTP 200-500 ms per request, no retry, dead-code scalability signal.

Seams with integration risk:
- `queue` instantiated without `REDIS_URL` → BullMQ silently uses `localhost:6379` or throws at runtime; `server.ts:7` never calls `initRedis`, `bootstrap` never starts worker, PostHog queue not flushed.
- `sendEmail` constructs `Mailgen` HTML + plaintext inside handler, then `resend.emails.send` with `from: process.env.RESEND_FROM_EMAIL!` — two env sources, no backoff, error swallowed as `throw new Error('Email delivery failed: ...')` losing `response.error`.
- No job schema — `job.data` is `console.log` opaque; no `attempts`, no `backoff`, no `removeOnComplete`. If Resend 429, no retry.
- Tests need live Resend key; In-memory path absent — `pnpm test` requires `.env` with real keys.

Shallow modules: `queues.ts` 3 LoC, `workers.ts` 10 LoC, `mail.ts` 121 LoC but interface is `sendEmail({email,subject,mailgenContent})` — nearly implementation size. No domain owns email invariants (retry, templating, queue vs direct).

## Proposed Interface

**Deep module `src/modules/email` — `Enqueue → BullMQ → Worker → Resend`, hidden behind `EmailPort` already used by `AuthDomain`.**

### Public surface — `src/modules/email/`

```typescript
// src/modules/email/types.ts
export type EmailJob = { to: string; subject: string; html: string; text: string };
export type EmailJobResult = { id: string };

// src/modules/email/queue.ts — hides BullMQ + IORedis + retry policy
export function getEmailQueue(): Queue<EmailJob> | null; // explicit REDIS_URL, logs warn if missing
export function enqueueEmail(job: EmailJob): Promise<{ id: string } | null>;
export function closeEmailQueue(): Promise<void>;

// src/modules/email/worker.ts — hides Resend + concurrency + error handling
export function startEmailWorker(opts: { resendApiKey: string; from: string }): Worker<EmailJob> | null;
export function closeEmailWorker(): Promise<void>;

// src/modules/auth/adapters/queuedEmailAdapter.ts — EmailPort impl
export class QueuedEmailAdapter implements EmailPort {
  constructor(opts: { apiKey: string; from: string });
  send(opts: { to: string; subject: string; html: string; text: string }): Promise<{ id: string }>;
  // enqueues if REDIS_URL configured, else falls back to direct ResendEmailAdapter (3× retry)
}
```

### Usage — before vs after

**Before `auth.controller.ts:119` (blocking, handler owns templating):**
```typescript
await sendEmail({
  email: user.email,
  subject: 'Please verify your email',
  mailgenContent: emailVerificationMailgenContent(user.username!, verificationUrl),
});
// handler blocks ~300ms, fails request if Resend down, no retry
```

**After `AuthDomain.register` via `EmailPort` (domain owns templating, queue hides transport):**
```typescript
// inside AuthDomain (already deepened) — templates remain in utils/mailTemplates, but send is via port
const html = mailGenerator.generate(emailVerificationMailgenContent(username, verificationUrl));
const text = mailGenerator.generatePlaintext(emailVerificationMailgenContent(username, verificationUrl));
await this.ports.email.send({ to: user.email, subject: 'Please verify your email', html, text });
// `this.ports.email` is QueuedEmailAdapter in prod (enqueues, returns immediately, worker sends with retry)
// In tests: InMemoryEmailAdapter (captures sent[])
// Worker (src/modules/email/worker.ts): `resend.emails.send({ from, to, subject, html, text })` with 5 concurrency, 3 attempts, exponential backoff
```

**Production wiring `bootstrap.ts:14`:**
```typescript
const emailAdapter = process.env.REDIS_URL
  ? new QueuedEmailAdapter({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL })
  : undefined; // createAuth falls back to ResendEmailAdapter
const auth = createAuth({ email: emailAdapter, config: { ... } });
if (process.env.REDIS_URL && env.RESEND_API_KEY) startEmailWorker({ resendApiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL });
process.on('SIGTERM', async () => { await closeEmailWorker(); await closeEmailQueue(); });
```

**Test `AuthDomain` boundary (no Redis):**
```typescript
const email = new InMemoryEmailAdapter(); // sent: EmailJob[]
const auth = createAuthDomain(config, { users: new InMemoryUserRepository(), email, cache: new InMemoryCacheAdapter(), ... });
await auth.register({ email: 'a@b.com', username: 'alice', password: 'Str0ng!Pass1@', host: 'localhost', protocol: 'http' });
expect(email.sent[0].to).toBe('a@b.com');
expect(email.sent[0].subject).toBe('Please verify your email');
```

### What it hides internally

| Hidden | Previously scattered | Now inside `src/modules/email` |
|---|---|---|
| Queue connection | `queues.ts:3` bare `new Queue` implicit localhost | `getEmailQueue()` explicit `new IORedis(REDIS_URL)` with `enableReadyCheck:false`, logs `REDIS_URL not configured` warn, `defaultJobOptions: { attempts:3, backoff:exponential 1s, removeOnComplete:100 }` |
| Job schema + retry | `workers.ts:9` `console.log(job.data)` | Typed `EmailJob`, `Worker` concurrency 5, `completed/failed/error` listeners, Resend 429 → throw for BullMQ retry |
| Templating | `sendEmail` did `mailGenerator.generatePlaintext/html` inside handler | Domain does `mailGenerator.generate` (Mailgen hidden in domain), queue/worker only sees `{html,text}` — no Mailgen in queue |
| Env normalization | `mail.ts:5,15` threw at import, `queues.ts:3` ignored REDIS_URL | Adapter constructors validate once; missing keys fallback to direct or InMemory, not crash at import |
| Lifecycle | `server.ts:7` never started worker, separate `pnpm worker` | `bootstrap.ts:38` `startEmailWorker` in same process when `REDIS_URL`+`RESEND_API_KEY` present, `closeEmailQueue/Worker` on `SIGTERM` |

## Dependency Strategy

- **2. Local-substitutable (BullMQ/Redis):** Queue/Worker hide `ioredis` + `bullmq`. Prod: real `IORedis(REDIS_URL)` with `maxRetriesPerRequest:null`. Test: `InMemoryEmailAdapter` (no Redis) + `InMemoryQueue` not needed — `EmailPort` is mocked, queue disabled when `REDIS_URL` absent (logs warn, returns `null`, `QueuedEmailAdapter` falls back to direct).
- **4. True external (Resend API — mock):** Worker hides `resend.emails.send`. Prod: `Resend(apiKey).emails.send({from,to,subject,html,text})` with response.error mapping. Test: `InMemoryEmailAdapter.sent` array asserted, no network. No `testcontainers` — mocked at boundary.
- **1. In-process:** Mailgen templating (`mailTemplates.ts`) merged into domain (pure HTML generation), not a port.

## Testing Strategy

- **New boundary tests to write (at `AuthDomain` + `EmailPort` interface — survive internal swaps):**
  - `register → email enqueued` (prod `QueuedEmailAdapter` with `REDIS_URL` mock: assert `queue.add('sendEmail', {to,subject,html})` called, not `resend.emails.send` blocking; test `enqueueEmail` with fake IORedis).
  - `register → email sent via InMemory` (current smoke): `email.sent[0].to === 'a@b.com'`, `subject === 'Please verify your email'`, `html` contains `verify-email/<token>`; worker not needed.
  - Retry: simulate `response.error` 429 on first `resend.emails.send`, assert retry succeeds within 3 attempts (Queued path via BullMQ `attempts:3`, direct `ResendEmailAdapter` retries 3× with 200ms backoff).
  - Fallback: without `REDIS_URL`, `QueuedEmailAdapter` falls back to direct send (assert `resend.emails.send` called); with `REDIS_URL` but queue `add` fails, also falls back.
  - Lifecycle: `startEmailWorker` without `RESEND_API_KEY` → no worker (warn), `closeEmailQueue/Worker` drains without leaking handles (checked via `afterAll`).

- **Old tests to delete:** Per `replace, don't layer` — delete shallow `sendEmail` unit mocks asserting `resend.emails.send({from: process.env.RESEND_FROM_EMAIL})` and `queues.ts` stub tests. Keep only `EmailPort` boundary + `ResendEmailAdapter` narrow contract (retry once on 429) + `queue` lifecycle.

- **Test environment needs:** No live Resend/Redis in CI — `InMemoryEmailAdapter` + `QueuedEmailAdapter` fallback path covers 90%; queue path tested with `ioredis-mock` or fake `Queue` spy. No `REDIS_URL` required for `pnpm test`.

## Implementation Recommendations

**What the module should own:**
- Email job lifecycle: `enqueue` (non-blocking HTTP), `process` (worker with 5 concurrency), `retry` (3× exponential), `cleanup` (`removeOnComplete:100`). Single `EmailJob` schema `{to,subject,html,text}` — no Mailgen in queue.

**What it should hide:**
- `bullmq` `Queue`/`Worker`/`Job`, `ioredis` connection, `resend` SDK response shape, `Mailgen` rendering (domain generates HTML, queue sees rendered), `from` header, `REDIS_URL` optional.

**What it should expose:**
- `enqueueEmail`, `getEmailQueue`, `startEmailWorker`, `closeEmailQueue/Worker` (lifecycle), `QueuedEmailAdapter implements EmailPort`. `AuthDomain` only sees `EmailPort.send` — enqueue vs direct is adapter choice, not domain concern.

**How callers should migrate:**
1. **Phase 0 (done):** Deep module `src/modules/email/{queue,worker,types}` replaces `src/queues/{queues,workers}` stubs; legacy files now delegate (`queues.ts` `getEmailQueue`, `workers.ts` `startEmailWorker` for `pnpm worker` compat).
2. **Phase 1:** `AuthDomain` already uses `EmailPort`; production `bootstrap.ts` chooses `QueuedEmailAdapter` when `REDIS_URL` set (non-blocking). No handler changes.
3. **Phase 2:** Migrate remaining direct `sendEmail` callers (`password.controller.ts:43` still `await sendEmail`) to `EmailPort` via `AuthDomain` (already done for `register/forgot`); delete `utils/mail.ts` direct `sendEmail` when zero imports.
4. **Phase 3:** If scaling, split `pending` worker to separate process: `pnpm worker` now calls `startEmailWorker` (same deep module) not stub; main `bootstrap` can disable worker (`startEmailWorker` only when `NODE_ENV !== 'worker'`).


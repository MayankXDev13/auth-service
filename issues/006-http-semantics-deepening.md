# RFC: Deepen HTTP Semantics — Unified `lib/http` over Shallow Utils

## Problem

**Four shallow files owning one contract** — `src/utils/ApiError.ts:34` (34 LoC `class ApiError extends Error {statusCode, success=false, errors[], data:null}`), `src/utils/ApiResponse.ts:18` (`class ApiResponse<T> {statusCode, success, message, data}` with `success=statusCode<400`), `src/utils/asyncHandler.ts:15` (`asyncHandler(fn)=>(req,res,next)=>Promise.resolve(fn()).catch(next)`), `src/middlewares/error.middleware.ts:49` (`(err,req,res,next)=> normalizes to ApiError, logs via winston, JSON {success:false,message,errors,stack?}` with `.js` suffix `import logger from '../logger/winston.logger.js'`). Each is shallow — interface (≈1 class/function) nearly equals implementation — yet every handler imports 3 utils separately (`import {ApiError} from '../../utils/ApiError'`, `ApiResponse`, `asyncHandler` in 6 controllers, 12 files total).

Four-file bounce to understand one response: `auth.controller.ts:144` `new ApiResponse(201,{userId},'...')` → `utils/ApiResponse.ts:8` constructor → `error.middleware.ts:41` JSON shape → `asyncHandler.ts:12` `catch(next)`; error path `throw new ApiError(400,'exists')` → `error.middleware.ts:17` `instanceof ApiError` → JSON. `success` derived from `statusCode<400` in `ApiResponse`, but `success:false` hard-coded in `ApiError` — coupling, duplicated logic. `ApiError` vs `AuthError` (from `modules/auth`) requires `errorHandler` to handle both, but old handler only knew `ApiError` (now patched). `asyncHandler` hides `next(err)` but is 15 LoC indirection; removing it would inline `try/catch`, keeping it is shallow.

Integration risk: handlers sometimes `throw new ApiError`, sometimes `throw new Error` (wrapped as 500), sometimes return `res.status(201).json(new ApiResponse(...))` with `success` boolean redundant. `error.middleware.ts:2` uses `.js` suffix while 48 other imports omit, NodeNext fragility. No helpers (`successResponse`, `createdResponse`) — 13× `new ApiResponse(200, data, 'User logged in successfully')` repetition.

## Proposed Interface

**Deep module `src/lib/http` — small interface (4 exports) hides 100 LoC implementation: `ApiError`, `ApiResponse` + helpers, `asyncHandler`, `errorHandler` shared JSON contract.**

### File topology (after)

- `src/lib/http/errors.ts:13` — deep `ApiError` (single error type, `statusCode`, `success=false`, `errors[]`, `captureStackTrace`).
- `src/lib/http/response.ts:20` — `ApiResponse` + helpers `successResponse(data,msg,200)`, `createdResponse(data,msg)`, `noContentResponse(msg)` hide `statusCode/success` coupling.
- `src/lib/http/asyncHandler.ts:12` — `asyncHandler` hides `Promise→next` translation.
- `src/lib/http/errorMiddleware.ts:32` — `errorHandler` hides `AuthError→ApiError` mapping, generic `Error→500`, `logger.error` shape, `stack` dev-only, `.js` suffix removed.
- `src/lib/http/index.ts:12` — single import `from 'lib/http'` hides 4 files, `In-process` dependency.
- `src/utils/ApiError.ts:4`, `ApiResponse.ts:4`, `asyncHandler.ts:4` — `@deprecated` re-exports `from '../lib/http'` for 12-file backward compat.
- `src/middlewares/error.middleware.ts:4` — `@deprecated` re-export `from '../lib/http'` (fixes `.js` suffix).

### Public surface

```typescript
// src/lib/http/index.ts — deep module, 4 exports
export { ApiError } from './errors';
export { ApiResponse, successResponse, createdResponse, noContentResponse } from './response';
export { asyncHandler } from './asyncHandler';
export { errorHandler } from './errorMiddleware';

// Previously 3 separate imports per handler:
// import { ApiError } from '../../utils/ApiError';
// import { ApiResponse } from '../../utils/ApiResponse';
// import { asyncHandler } from '../../utils/asyncHandler';
// import { errorHandler } from '../../middlewares/error.middleware';

// Now 1 import:
import { ApiError, ApiResponse, asyncHandler, errorHandler, successResponse, createdResponse } from '../../lib/http';

// Usage — before vs after
// Before auth.controller.ts:141
return res.status(201).json(new ApiResponse(201, { userId: user.id }, 'Users registered successfully...'));

// After (helper hides statusCode/success)
return res.status(201).json(createdResponse({ userId: user.id }, 'Users registered successfully...'));
return res.status(200).json(successResponse(user, 'User logged in successfully'));

// Error path — unified (AuthError maps via errorHandler)
throw new ApiError(400, 'User with given email or username already exists');
// or throw new AuthError('USER_EXISTS', '...') → errorHandler converts toApiError() → same JSON
```

### What it hides internally

| Hidden | Previously 4 files | Now inside `lib/http` |
|---|---|---|
| `success = statusCode < 400` coupling | `ApiResponse:12` `success=statusCode<400`, `ApiError:20` `success=false` hard-coded | `ApiResponse` constructor + helpers `successResponse/createdResponse` hide coupling |
| `Promise→next` | `asyncHandler.ts:12` `Promise.resolve(fn()).catch(next)` | `lib/http/asyncHandler` same but co-located |
| JSON contract | `error.middleware.ts:44` `res.status(error.statusCode).json({success:false,message,errors,stack?})` with dev-only stack | `lib/http/errorMiddleware` single contract, handles `AuthError`, `ApiError`, generic `Error→500` |
| Logger shape | `logger.error(error.message,{statusCode,method,path,stack})` scattered | Co-located |
| Import suffix fragility | `error.middleware.ts:2` `import logger from '../logger/winston.logger.js'` `.js` suffix | Consistent no-suffix `import logger from '../../logger/winston.logger'` |

## Dependency Strategy

- **In-process**: Pure computation, no I/O. `ApiError`/`ApiResponse`/`asyncHandler` merged directly into deep module; `errorHandler` logs via `winston` (in-process, no port).

## Testing Strategy

- **New boundary tests to write (at `lib/http` interface — survive refactors, assert JSON contract):**
  - `ApiError(400,'bad',[{field:'email',msg}])` → `statusCode 400, success false, message 'bad', errors.length 1`; `ApiResponse(201,{id},'created')` → `statusCode 201, success true`.
  - `successResponse({id:1},'ok')` → `200, success true`, `createdResponse({id:2})` → `201`, `errorHandler(new ApiError(400,'Validation failed',errors))` → `res.status(400).json({success:false,message,errors,stack?})`.
  - `errorHandler(new AuthError('USER_EXISTS','exists'))` → `400` via `toApiError()`, `errorHandler(new Error('boom'))` → `500, message 'boom'`.
  - `asyncHandler(async (req,res)=>{throw new ApiError(401,'unauth')})` → `next(err)` called with `ApiError`.
  - Backward compat — `import {ApiError} from '../../utils/ApiError'` still resolves (re-export), `import {errorHandler} from '../../middlewares/error.middleware'` still works (re-export, no `.js` suffix).

- **Old tests to delete:** Per `replace, don't layer` — delete shallow per-util `ApiError` constructor tests, `ApiResponse` `success` boolean tests, `asyncHandler` `catch(next)` isolated tests — replaced by `lib/http` boundary suite asserting JSON contract.

- **Test environment needs:** None — pure in-memory, no DB. Run `pnpm exec tsx` without `.env`.

## Implementation Recommendations

**What the module should own:**
- HTTP boundary contract: error (`ApiError` + `AuthError` mapping), response envelope (`ApiResponse` + helpers), async boundary (`asyncHandler`), error handler JSON (`success:false,message,errors,stack?` dev-only). Single `lib/http` owns `statusCode↔success` derivation.

**What it should hide:**
- `statusCode<400` success logic, `Promise.resolve(fn()).catch(next)` indirection, `logger.error` field mapping, `.js` suffix, `stack` dev guard, `errors[]` shape.

**What it should expose:**
- `ApiError`, `ApiResponse`, `asyncHandler`, `errorHandler`, `successResponse`, `createdResponse`, `noContentResponse`. Single `import { ApiError, ApiResponse, asyncHandler } from 'lib/http'`.

**How callers should migrate:**
1. **Phase 0 (done):** Deep module `src/lib/http/{errors,response,asyncHandler,errorMiddleware,index}.ts` created; `src/utils/ApiError|ApiResponse|asyncHandler` now `@deprecated` re-exports `from '../lib/http'` (12 files still work), `src/middlewares/error.middleware.ts` re-export (fixes `.js` suffix).
2. **Phase 1:** New handlers import `from 'lib/http'` directly; replace `new ApiResponse(201, data, msg)` with `createdResponse(data, msg)` and `new ApiResponse(200, data, msg)` with `successResponse(data, msg)` where ergonomic (13 call-sites).
3. **Phase 2:** When zero imports of `utils/Api*` remain, delete `src/utils/Api*` files and update `no-restricted-imports` lint to forbid `from 'utils/ApiError'`; `src/middlewares/error.middleware.ts` can be removed (canonical is `lib/http`).


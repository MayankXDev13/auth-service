/**
 * Deep HTTP module — single import for HTTP semantics: error, response, async boundary, handler.
 * Previously: src/utils/ApiError (34 LoC), ApiResponse (18 LoC), asyncHandler (15 LoC) scattered 3 files, each shallow (interface ≈ implementation),
 * plus src/middlewares/error.middleware.ts 49 LoC with .js suffix — 4-file bounce to understand one response.
 * Now: 1 import `from 'lib/http'` hides statusCode/success coupling, Promise→next translation, JSON contract.
 *
 * Deep module: small interface (ApiError, ApiResponse, asyncHandler, errorHandler, helpers) hides 100 LoC implementation.
 * Dependency: 1. In-process — pure computation, no I/O.
 */
export { ApiError } from './errors';
export { ApiResponse, successResponse, createdResponse, noContentResponse } from './response';
export { asyncHandler } from './asyncHandler';
export { errorHandler } from './errorMiddleware';

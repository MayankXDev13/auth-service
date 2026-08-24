/**
 * Deep HTTP error — single error type for HTTP boundary.
 * Previously: src/utils/ApiError.ts 34 LoC shallow class imported in 12 files.
 * Now: owned by src/lib/http deep module, co-located with response + handler.
 */

export class ApiError extends Error {
  public statusCode: number;
  public success: boolean = false;
  public errors: any[];
  public data: null = null;

  constructor(statusCode: number, message: string = 'Something went wrong', errors: any[] = [], stack?: string) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    if (stack) this.stack = stack;
    else Error.captureStackTrace(this, this.constructor);
  }
}

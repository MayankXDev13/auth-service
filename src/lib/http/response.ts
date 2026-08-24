/**
 * Deep HTTP response — unified envelope for success responses.
 * Previously: src/utils/ApiResponse.ts 18 LoC shallow class imported in 6 controllers.
 * Now: co-located with error + handler, exposes helpers to hide statusCode/success coupling.
 */

export class ApiResponse<T = any> {
  public statusCode: number;
  public success: boolean;
  public message: string;
  public data: T;

  constructor(statusCode: number, data: T, message: string = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

// Ergonomic helpers — hide `new ApiResponse(200, data, msg)` repetition (previously 13× inline in controllers)
export function successResponse<T>(data: T, message = 'Success', statusCode = 200): ApiResponse<T> {
  return new ApiResponse(statusCode, data, message);
}

export function createdResponse<T>(data: T, message = 'Created'): ApiResponse<T> {
  return new ApiResponse(201, data, message);
}

export function noContentResponse(message = 'No content'): ApiResponse<null> {
  return new ApiResponse(204, null, message);
}

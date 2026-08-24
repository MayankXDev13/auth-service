import { ApiError } from '../../utils/ApiError';

export type AuthErrorCode =
  | 'USER_EXISTS'
  | 'USER_NOT_FOUND'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DEACTIVATED'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID_OR_EXPIRED'
  | 'EMAIL_ALREADY_VERIFIED'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'USERNAME_TAKEN'
  | 'SAME_PASSWORD'
  | 'INVALID_OLD_PASSWORD'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED';

const codeToStatus: Record<AuthErrorCode, number> = {
  USER_EXISTS: 400,
  USER_NOT_FOUND: 404,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DEACTIVATED: 401,
  UNAUTHORIZED: 401,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID_OR_EXPIRED: 400,
  EMAIL_ALREADY_VERIFIED: 409,
  INVALID_FILE_TYPE: 400,
  FILE_TOO_LARGE: 400,
  USERNAME_TAKEN: 409,
  SAME_PASSWORD: 400,
  INVALID_OLD_PASSWORD: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
};

export class AuthError extends Error {
  code: AuthErrorCode;
  statusCode: number;
  errors: any[];

  constructor(code: AuthErrorCode, message: string, errors: any[] = []) {
    super(message);
    this.code = code;
    this.statusCode = codeToStatus[code];
    this.errors = errors;
  }

  toApiError(): ApiError {
    return new ApiError(this.statusCode, this.message, this.errors);
  }
}

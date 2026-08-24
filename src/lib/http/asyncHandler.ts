/**
 * Deep async boundary — hides Promise → next(err) translation.
 * Previously: src/utils/asyncHandler.ts 15 LoC shallow indirection imported in 6 controllers.
 * Now: co-located with error/response, single import `from 'lib/http'`.
 */
import type { Request, Response, NextFunction } from 'express';

export const asyncHandler =
  <TReq = Request, TRes = Response>(
    requestHandler: (req: TReq, res: TRes, next: NextFunction) => Promise<any>
  ) =>
  (req: TReq, res: TRes, next: NextFunction): void => {
    Promise.resolve(requestHandler(req, res, next)).catch(next);
  };

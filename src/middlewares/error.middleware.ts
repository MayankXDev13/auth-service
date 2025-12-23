import type { Request, Response, NextFunction } from "express";
import logger from "../logger/winston.logger.js";
import { ApiError } from "../utils/ApiError.js";

const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error: ApiError;

  if (err instanceof ApiError) {
    error = err;
  } else {
    const statusCode =
      typeof err === "object" &&
      err !== null &&
      "statusCode" in err &&
      typeof (err as any).statusCode === "number"
        ? (err as any).statusCode
        : 500;

    const message =
      err instanceof Error ? err.message : "Something went wrong";

    error = new ApiError(
      statusCode,
      message,
      [],
      err instanceof Error ? err.stack : undefined
    );
  }

  logger.error(error.message, {
    statusCode: error.statusCode,
    method: req.method,
    path: req.path,
    stack: error.stack,
  });

  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    errors: error.errors,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};

export { errorHandler };

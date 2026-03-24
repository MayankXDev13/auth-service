import { Request, Response, NextFunction } from "express";
import { ZodObject, ZodIssue } from "zod";
import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError";

export const validate = (schema: ZodObject<any>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Check express-validator errors first
      const validatorErrors = validationResult(req);
      if (!validatorErrors.isEmpty()) {
        const errorMessages = validatorErrors.array().map(err => ({
          field: (err as any).param || (err as any).path,
          message: err.msg
        }));
        throw new ApiError(400, "Validation failed", errorMessages);
      }

      // Then check Zod schema
      schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error.issues) {
        const errorMessages = error.issues.map((err: ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        throw new ApiError(400, "Validation failed", errorMessages);
      }
      next(error);
    }
  };
};
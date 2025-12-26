import { Request, Response, NextFunction } from "express";
import { ZodObject, ZodIssue } from "zod";
import { ApiError } from "../utils/ApiError";

export const validate = (schema: ZodObject<any>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
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
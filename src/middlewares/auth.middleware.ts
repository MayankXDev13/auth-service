import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { db } from "../config/db";
import { User } from "../db/schema";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";

export const verifyJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    try {
      const secret = process.env.ACCESS_TOKEN_SECRET;

      if (!secret) {
        throw new ApiError(500, "Server configuration error");
      }

      const decodedToken = jwt.verify(token, secret) as jwt.JwtPayload;

      const user = await db.query.User.findFirst({
        where: eq(User.id, decodedToken.userId),
        columns: {
          id: true,
          email: true,
          username: true,
          role: true,
        },
      });

      if (!user) {
        throw new ApiError(401, "Invalid access token");
      }

      req.user = user;

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, "Access token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, "Invalid access token");
      }
      throw new ApiError(401, "Authentication failed");
    }
  }
);

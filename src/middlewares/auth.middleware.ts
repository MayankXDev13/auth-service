import type { Request, Response, NextFunction } from "express";
import { verifyRefreshToken } from "../utils/jwt";

export interface JwtPayload {
  userId: string;
  role: "user" | "admin";
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: "user" | "admin" };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = verifyRefreshToken(token);
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Inavlid or expired token" });
  }
}

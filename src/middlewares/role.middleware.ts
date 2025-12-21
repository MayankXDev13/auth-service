import type { Request, Response, NextFunction } from "express";

export function requireRole(...allowedRoles: Array<"user" | "admin">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403);
    }
    next();
  };
}

import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import type { Request, Response } from "express";
import { db } from "../config/db";
import { User } from "../db/schema";

const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Test database connection
    await db.select().from(User).limit(1);
    
    return res
      .status(200)
      .json(new ApiResponse(200, {
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: "connected"
      }, "Health Check Passed"));
  } catch (error) {
    return res
      .status(503)
      .json(new ApiResponse(503, {
        status: "ERROR",
        timestamp: new Date().toISOString(),
        database: "disconnected"
      }, "Health Check Failed"));
  }
});

export { healthCheck };

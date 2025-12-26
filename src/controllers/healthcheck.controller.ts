import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import type { Request, Response } from "express";
import { pool } from "../config/db";


const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  const healthData = {
    status: "OK" as string,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    server: "running",
    database: "connected" as string,
    environment: process.env.NODE_ENV || "development"
  };

  try {
    // Test database connection using the pool directly (works even if tables are empty)
    await pool.query('SELECT 1 as test_query');
    healthData.database = "connected";
    
    return res
      .status(200)
      .json(new ApiResponse(200, healthData, "Health Check Passed"));
  } catch (error) {
    healthData.database = "disconnected";
    healthData.status = "DEGRADED";
    
    console.error("Database connection failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
      databaseUrl: process.env.DATABASE_URL ? "CONFIGURED" : "MISSING"
    });
    
    return res
      .status(503)
      .json(new ApiResponse(503, healthData, "Health Check Failed - Database Disconnected"));
  }
});

export { healthCheck };

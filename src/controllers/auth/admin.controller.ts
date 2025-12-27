import type { Request, Response } from "express";
import { User } from "../../db/schema";
import { db } from "../../config/db";
import { eq } from "drizzle-orm";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { posthog } from "../../lib/posthog";

/**
 * Assigns a role to a user (admin function)
 * @param req - Express request object containing userId and role
 * @param res - Express response object
 * @returns Promise resolving to role assignment response
 */
const assignRole = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  const user = await db.query.User.findFirst({
    where: eq(User.id, userId),
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  await db.update(User).set({ role }).where(eq(User.id, user.id));

  // PostHog "user_role_changed"
  // Admin actions audit
  // RBAC analytics
  posthog.capture({
    distinctId: user.id,
    event: "user_role_changed",
    properties: {
      role,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Role changed for the user"));
});

export {
  assignRole,
};
import type { Request, Response } from "express";
import { User } from "../../db/schema";
import { db } from "../../config/db";
import { and, eq, ne } from "drizzle-orm";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import logger from "../../logger/winston.logger";
import { posthog } from "../../lib/posthog";
import { uploadBuffer, deleteObject } from "../../utils/s3";
import { getCachedUser, cacheUser, deleteCachedUser } from "../../utils/cache";

/**
 * Gets the current authenticated user's profile
 * @param req - Express request object
 * @param res - Express response object
 * @returns Promise resolving to current user data
 */
const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id!;

  // Try to get from cache first
  let userData = await getCachedUser(userId);

  if (!userData) {
    // Fetch from database if not cached
    const user = await db.query.User.findFirst({
      where: eq(User.id, userId),
      columns: {
        id: true,
        email: true,
        username: true,
        role: true,
        profilePicture: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    userData = user;
    // Cache for 30 minutes
    await cacheUser(userId, userData, 1800);
  }

  logger.info("Current user fetched", { userId });
  return res
    .status(200)
    .json(new ApiResponse(200, userData, "Current user fetched successfully"));
});

/**
 * Updates the current user's username
 * @param req - Express request object containing new username
 * @param res - Express response object
 * @returns Promise resolving to username update response
 */
const updateUsername = asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.body;
  const userId = req.user!.id!;

  // Check if username is already taken by another user
  const existingUser = await db.query.User.findFirst({
    where: and(eq(User.username, username), ne(User.id, userId)),
  });

  if (existingUser) {
    throw new ApiError(409, "Username is already taken");
  }

  // Update username
  await db.update(User).set({ username }).where(eq(User.id, userId));

  // PostHog analytics
  posthog.capture({
    distinctId: userId,
    event: "username_updated",
  });

  return res.status(200).json(
    new ApiResponse(200, { username }, "Username updated successfully")
  );
});

/**
 * Uploads a profile picture for the current user
 * @param req - Express request object containing uploaded file
 * @param res - Express response object
 * @returns Promise resolving to profile picture upload response
 */
const uploadProfilePicture = asyncHandler(
  async (req: Request, res: Response) => {
    const file = (req as any).file;
    if (!file) {
      throw new ApiError(400, "No file uploaded");
    }
    const { buffer, mimetype, originalname } = file;
    const userId = req.user!.id!;

    // Get current profile picture
    const currentUser = await db.query.User.findFirst({
      where: eq(User.id, userId),
      columns: { profilePicture: true },
    });
    const oldUrl = currentUser?.profilePicture;

    try {
      const s3Url = await uploadBuffer(buffer, userId, mimetype, originalname);

      // Delete old avatar if exists
      if (oldUrl && oldUrl.includes(process.env.S3_BUCKET!)) {
        try {
          const oldKey = oldUrl.split('/').slice(3).join('/');
          await deleteObject(oldKey);
        } catch (deleteError) {
          logger.warn("Failed to delete old avatar", { error: deleteError });
          // Don't fail the upload if delete fails
        }
      }

      await db
        .update(User)
        .set({ profilePicture: s3Url })
        .where(eq(User.id, userId));

      // PostHog event
      posthog.capture({
        distinctId: userId,
        event: "profile_picture_uploaded",
      });

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { profilePicture: s3Url },
            "Profile picture uploaded successfully"
          )
        );
    } catch (error) {
      logger.error("Profile picture upload error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new ApiError(
        400,
        error instanceof Error ? error.message : "Upload failed"
      );
    }
  }
);

export {
  getCurrentUser,
  updateUsername,
  uploadProfilePicture,
};
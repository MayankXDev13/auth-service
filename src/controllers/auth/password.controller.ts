import type { Request, Response } from "express";
import { User } from "../../db/schema";
import { db } from "../../config/db";
import { and, eq, gt } from "drizzle-orm";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { forgotPasswordMailgenContent, sendEmail } from "../../utils/mail";
import logger from "../../logger/winston.logger";
import { posthog } from "../../lib/posthog";
import { env } from "../../config/env";

/**
 * Requests a password reset for a user
 * @param req - Express request object containing email
 * @param res - Express response object
 * @returns Promise resolving to password reset request response
 */
const forgotPasswordRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await db.query.User.findFirst({
      where: eq(User.email, email),
    });

    if (!user) {
      throw new ApiError(404, "User does not exists");
    }

    const { hashedToken, unHashedToken, tokenExpiry } = generateTemporaryToken();

    await db
      .update(User)
      .set({
        forgotPasswordToken: hashedToken,
        forgotPasswordTokenExpiresAt: new Date(tokenExpiry),
      })
      .where(eq(User.id, user.id));

    await sendEmail({
      email: user.email,
      subject: "Password reset request",
      mailgenContent: forgotPasswordMailgenContent(
        user.username!,
        `${env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`
      ),
    });

    // PostHog "password_reset_requested"
    // account recovery tracking
    // security insights

    posthog.capture({
      distinctId: user.id,
      event: "password_reset_requested",
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {},
          "Password reset mail has been sent on your mail id"
        )
      );
  }
);

/**
 * Resets a user's forgotten password using reset token
 * @param req - Express request object containing reset token and new password
 * @param res - Express response object
 * @returns Promise resolving to password reset response
 */
const resetForgottenPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    logger.info("Password reset attempt with token");

    const user = await db.query.User.findFirst({
      where: and(
        eq(User.forgotPasswordToken, hashedToken),
        gt(User.forgotPasswordTokenExpiresAt, new Date())
      ),
    });

    if (!user) {
      throw new ApiError(400, "Token is invalid or expired");
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password!);

    if (isSamePassword) {
      throw new ApiError(400, "New password cannot be same as old password");
    }

    const hashPassword = await bcrypt.hash(newPassword, 12);

    await db
      .update(User)
      .set({
        password: hashPassword,
        forgotPasswordToken: null,
        forgotPasswordTokenExpiresAt: null,
      })
      .where(eq(User.id, user.id));

    // PostHog "password_reset_completed"
    // recovery success rate
    posthog.capture({
      distinctId: user.id,
      event: "password_reset_completed",
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password reset successfully"));
  }
);

/**
 * Changes the current user's password
 * @param req - Express request object containing old and new passwords
 * @param res - Express response object
 * @returns Promise resolving to password change response
 */
const changeCurrentPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;

    const user = await db.query.User.findFirst({
      where: eq(User.id, req.user!.id!),
    });

    const isPasswordValid = await bcrypt.compare(oldPassword, user!.password!);

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid old password");
    }
    const isSamePassword = await bcrypt.compare(newPassword, user!.password!);

    if (isSamePassword) {
      throw new ApiError(400, "New password cannot be same as old password");
    }

    const hashPassword = await bcrypt.hash(newPassword, 12);
    await db
      .update(User)
      .set({ password: hashPassword })
      .where(eq(User.id, user?.id!));

    // PostHog "password_changed"
    // security behavior
    // account hygiene
    posthog.capture({
      distinctId: user?.id!,
      event: "password_changed",
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully"));
  }
);

/**
 * Generates a temporary token for password reset
 * @returns Object containing hashedToken, unHashedToken, and tokenExpiry
 */
const generateTemporaryToken = () => {
  const unHashedToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex");

  const USER_TEMPORARY_TOKEN_EXPIRY = 20 * 60 * 1000; // 20 minutes
  const tokenExpiry = Date.now() + USER_TEMPORARY_TOKEN_EXPIRY;
  return { hashedToken, unHashedToken, tokenExpiry };
};

export {
  forgotPasswordRequest,
  resetForgottenPassword,
  changeCurrentPassword,
};
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../../db/schema";
import { db } from "../../config/db";
import { and, eq, gt, or } from "drizzle-orm";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  emailVerificationMailgenContent,
  sendEmail,
} from "../../utils/mail";
import logger from "../../logger/winston.logger";
import { posthog } from "../../lib/posthog";
import { env } from "../../config/env";

/**
 * Generates access and refresh tokens for a user
 * @param userId - The user's ID
 * @returns Object containing accessToken and refreshToken
 */
const generateAccessAndRefreshToken = async (userId: string) => {
  try {
    const user = await db.query.User.findFirst({
      where: eq(User.id, userId),
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: env.ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      env.REFRESH_TOKEN_SECRET,
      { expiresIn: env.REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
    );

    await db
      .update(User)
      .set({ refreshToken })
      .where(eq(User.id, userId));

    return { accessToken, refreshToken };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error("Token generation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new ApiError(
      500,
      "Something went wrong while generating the access and refresh tokens"
    );
  }
};

/**
 * Generates a temporary token for email verification or password reset
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

/**
 * Registers a new user account
 * @param req - Express request object containing user data
 * @param res - Express response object
 * @returns Promise resolving to user registration response
 */
const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  const existedUser = await db.query.User.findFirst({
    where: or(eq(User.email, email), eq(User.username, username)),
  });

  if (existedUser) {
    throw new ApiError(400, "User with given email or username already exists");
  }

  const { hashedToken, unHashedToken, tokenExpiry } = generateTemporaryToken();

  const hashPassword = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(User)
    .values({
      email,
      password: hashPassword,
      username,
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: new Date(tokenExpiry),
      loginType: "email_password",
    })
    .returning();

  if (!user) {
    throw new ApiError(500, "Failed to register user");
  }

  await sendEmail({
    email: user.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username!,
      `${req.protocol}://${req.get(
        "host"
      )}/api/v1/users/verify-email/${unHashedToken}`
    ),
  });

  // PostHog "user_registered"
  // signup count
  // signup conversion funnel
  posthog.capture({
    distinctId: user.id,
    event: "user_registered",
    properties: {
      method: user.loginType,
    },
  });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { userId: user.id },
        "Users registered successfully and verification email has been sent on your email."
      )
    );
});

/**
 * Logs in a user with email/username and password
 * @param req - Express request object containing login credentials
 * @param res - Express response object
 * @returns Promise resolving to user login response
 */
const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "Username or email is required to login");
  }

  const user = await db.query.User.findFirst({
    where: or(eq(User.email, email), eq(User.username, username)),
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password!);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user.id
  );

  const loggedInUser = await db.query.User.findFirst({
    where: and(eq(User.id, user.id), eq(User.isActive, true)),
    columns: {
      id: true,
      email: true,
      username: true,
      role: true,
      profilePicture: true,
      isEmailVerified: true,
      lastLoginAt: true,
    },
  });

  // PostHog "user_logged_in"
  // daily active users
  // login success rate
  posthog.capture({
    distinctId: user.id,
    event: "user_logged_in",
    properties: {
      method: "password",
    },
  });

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

/**
 * Logs out the current user
 * @param req - Express request object
 * @param res - Express response object
 * @returns Promise resolving to logout response
 */
const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  await db
    .update(User)
    .set({ refreshToken: null })
    .where(eq(User.id, req.user.id));

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  // PostHog "user_logged_out"
  // session behavior
  // drop-off tracking
  posthog.capture({
    distinctId: req.user.id,
    event: "user_logged_out",
  });
  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

/**
 * Verifies a user's email address using verification token
 * @param req - Express request object containing verification token
 * @param res - Express response object
 * @returns Promise resolving to email verification response
 */
const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { verificationToken } = req.params;

  if (!verificationToken) {
    throw new ApiError(400, "Email verification token in missing");
  }
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const user = await db.query.User.findFirst({
    where: and(
      eq(User.emailVerificationToken, hashedToken),
      gt(User.emailVerificationExpiry, new Date())
    ),
  });

  if (!user) {
    throw new ApiError(400, "Token is invalid or expired");
  }

  await db
    .update(User)
    .set({
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    })
    .where(eq(User.id, user.id));

  // PostHog "email_verified"
  // email verification funnel
  // signup  -> activation conversion
  posthog.capture({
    distinctId: user.id,
    event: "email_verified",
  });
  return res
    .status(200)
    .json(new ApiResponse(200, { isEmailVerified: true }, "Email is verified"));
});

/**
 * Resends email verification to the current user
 * @param req - Express request object
 * @param res - Express response object
 * @returns Promise resolving to email resend response
 */
const resendEmailVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await db.query.User.findFirst({
      where: eq(User.id, req.user!.id),
    });

    if (!user) {
      throw new ApiError(404, "User does not exist");
    }

    if (user.isEmailVerified) {
      throw new ApiError(409, "Email is already verified!");
    }

    const { hashedToken, unHashedToken, tokenExpiry } =
      generateTemporaryToken();

    await db
      .update(User)
      .set({
        emailVerificationToken: hashedToken,
        emailVerificationExpiry: new Date(tokenExpiry),
      })
      .where(eq(User.id, user.id));

    await sendEmail({
      email: user.email,
      subject: "Please verify your email",
      mailgenContent: emailVerificationMailgenContent(
        user.username!,
        `${req.protocol}://${req.get(
          "host"
        )}/api/v1/users/verify-email/${unHashedToken}`
      ),
    });

    // PostHog "resend_email_verification"
    // detact eamil delivery issues
    // UX friction indicator
    posthog.capture({
      distinctId: user.id,
      event: "resend_email_verification",
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Mail has been sent to your mail ID"));
  }
);

/**
 * Refreshes the access token using refresh token
 * @param req - Express request object containing refresh token
 * @param res - Express response object
 * @returns Promise resolving to token refresh response
 */
const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken =
    (req.cookies && req.cookies.refreshToken) ||
    (req.body && req.body.refreshToken);

  logger.info("Refresh token validation attempt");

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is missing");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      env.REFRESH_TOKEN_SECRET
    ) as jwt.JwtPayload;

    const user = await db.query.User.findFirst({
      where: eq(User.id, decodedToken.userId),
    });

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user.id);

    await db.update(User).set({ refreshToken: newRefreshToken });

    // PostHog "access_token_refreshed"
    // session longevity
    // token rotation health
    posthog.capture({
      distinctId: user.id,
      event: "access_token_refreshed",
    });

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    logger.error("Token refresh error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new ApiError(401, "Invalid or expired refresh token");
  }
});

/**
 * Handles social login callback (OAuth)
 * @param req - Express request object containing user from OAuth
 * @param res - Express response object
 * @returns Promise resolving to social login response
 */
const handleSocialLogin = asyncHandler(async (req: Request, res: Response) => {
  const user = await db.query.User.findFirst({
    where: eq(User.id, req.user?.id as string),
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user.id
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  // PostHog "user_logged_in"
  // OAuth vs Email Comparison
  posthog.capture({
    distinctId: user.id,
    event: "user_logged_in",
    properties: {
      method: user.loginType,
    },
  });
  return res
    .status(301)
    .cookie("accessToken", accessToken, options) // set the access token in the cookie
    .cookie("refreshToken", refreshToken, options) // set the refresh token in the cookie
    .redirect(env.CLIENT_SSO_REDIRECT_URL);
});

export {
  registerUser,
  loginUser,
  logoutUser,
  verifyEmail,
  resendEmailVerification,
  refreshAccessToken,
  handleSocialLogin,
};
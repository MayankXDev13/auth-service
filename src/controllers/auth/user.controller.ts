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
  forgotPasswordMailgenContent,
  sendEmail,
} from "../../utils/mail";
import logger from "../../logger/winston.logger";
import { posthog } from "../../lib/posthog";

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
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
    );

    await db
      .update(User)
      .set({ refreshToken: refreshToken })
      .where(eq(User.id, userId));

    return { accessToken, refreshToken };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("Token generation error:", error);
    throw new ApiError(
      500,
      "Something went wrong while generating the access and refresh tokens"
    );
  }
};

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
        { user: user },
        "Users registered successfully and verification email has been sent on your email."
      )
    );
});

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
    where: eq(User.id, user.id),
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

const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }
  await db
    .update(User)
    .set({ refreshToken: null })
    .where(eq(User.id, req.user.userId!));

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  // PostHog "user_logged_out"
  // session behavior
  // drop-off tracking
  posthog.capture({
    distinctId: req.user.userId,
    event: "user_logged_out",
  });
  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { verificationToken } = req.params;

  if (!verificationToken) {
    throw new ApiError(400, "Email verification token in missing");
  }
  let hashedToken = crypto
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

const resendEmailVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await db.query.User.findFirst({
      where: eq(User.id, req.user!.userId!),
    });

    if (!user) {
      throw new ApiError(404, "User does not exists", []);
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

const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  logger.info(`Incoming Refresh Token: ${incomingRefreshToken}`);

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is missing");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET as string
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
  } catch (error) {}
});

const forgotPasswordRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await db.query.User.findFirst({
      where: eq(User.email, email),
    });

    if (!user) {
      throw new ApiError(404, "User does not exists");
    }

    const { hashedToken, unHashedToken, tokenExpiry } =
      generateTemporaryToken();

    logger.info(`Unhashed Token: ${unHashedToken}`);
    logger.info(`Hashed Token: ${hashedToken}`);
    logger.info(`Token Expiry: ${tokenExpiry}`);

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
        `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`
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

const resetForgottenPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;

    logger.info(`Reset Token: ${resetToken}`);

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    logger.info(`Hashed Reset Token: ${hashedToken}`);

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

const changeCurrentPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;

    const user = await db.query.User.findFirst({
      where: eq(User.id, req.user!.userId!),
    });

    const isPasswordValid = bcrypt.compare(oldPassword, user!.password!);

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

const assignRole = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  const user = await db.query.User.findFirst({
    where: eq(User.id, userId),
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  await db.update(User).set({ role: role }).where(eq(User.id, user.id));

  // PostHog "user_role_changed"
  // Admin actions audit
  // RBAC analytics
  posthog.capture({
    distinctId: user.id,
    event: "user_role_changed",
    properties: {
      role: role,
    },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Role changed for the user"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

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
    .redirect(
      // redirect user to the frontend with access and refresh token in case user is not using cookies
      `${process.env.CLIENT_SSO_REDIRECT_URL}?accessToken=${accessToken}&refreshToken=${refreshToken}`
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  verifyEmail,
  resendEmailVerification,
  refreshAccessToken,
  forgotPasswordRequest,
  resetForgottenPassword,
  changeCurrentPassword,
  assignRole,
  getCurrentUser,
  handleSocialLogin,
};

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { ApiError } from "../utils/ApiError";
import { User } from "../db/schema";
import { db } from "../config/db";
import { eq, or } from "drizzle-orm";
import logger from "../logger/winston.logger";
import { posthog } from "../lib/posthog";
import { env } from "../config/env";
import bcrypt from 'bcrypt';

passport.serializeUser((user: any, next) => {
  logger.info("[PASSPORT] serializeUser called", {
    userId: user?.id,
    email: user?.email,
    loginType: user?.loginType,
  });

  if (!user?.id) {
    logger.error("[PASSPORT] serializeUser failed: user.id missing", {
      user,
    });
    return next(new Error("serializeUser called without user.id"));
  }

  next(null, user.id);
});

passport.deserializeUser(async (id: string, next) => {
  try {
    logger.info("[PASSPORT] deserializeUser called", { id });

    const userResult = await db.select().from(User).where(eq(User.id, id)).limit(1);

    if (!userResult || userResult.length === 0) {
      logger.error("[PASSPORT] deserializeUser failed: user not found", {
        id,
      });
      return next(new ApiError(404, "User does not exist"));
    }

    const user = userResult[0];

    logger.info("[PASSPORT] deserializeUser success", {
      id: user.id,
      email: user.email,
      loginType: user.loginType,
    });

    next(null, user);
  } catch (error) {
    logger.error("[PASSPORT] deserializeUser error", { error });
    next(
      new ApiError(
        500,
        "Something went wrong deserializing user. Error: " + error
      )
    );
  }
});

// Local strategy for email/password authentication
passport.use(
  new LocalStrategy(
    {
      usernameField: "username", // Accepts both email or username
      passwordField: "password",
    },
    async (username, password, next) => {
      try {
        logger.info("[LOCAL] Authentication attempt", {
          username,
        });

        // Find user by email or username
        const userResult = await db
          .select()
          .from(User)
          .where(
            or(eq(User.email, username), eq(User.username, username))
          )
          .limit(1);

        if (!userResult || userResult.length === 0) {
          logger.warn("[LOCAL] User not found", { username });
          return next(new ApiError(401, "Invalid credentials"));
        }

        const user = userResult[0];

        // Check if user is active
        if (!user.isActive) {
          logger.warn("[LOCAL] Inactive user login attempt", { username });
          return next(new ApiError(401, "Account is deactivated"));
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password || "");
        if (!isPasswordValid) {
          logger.warn("[LOCAL] Invalid password", { username });
          return next(new ApiError(401, "Invalid credentials"));
        }

        logger.info("[LOCAL] Authentication successful", {
          id: user.id,
          email: user.email,
        });

        return next(null, user);
      } catch (error) {
        logger.error("[LOCAL] Authentication error", { error });
        return next(new ApiError(500, "Authentication failed"));
      }
    }
  )
);

// Google OAuth strategy (only if configured)
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        callbackURL: env.GOOGLE_CALLBACK_URL!,
      },
      async (_: any, __: any, profile: any, next: any) => {
        try {
          logger.info("[GOOGLE] OAuth callback received", {
            email: profile._json.email,
            googleId: profile._json.sub,
          });

          const userResult = await db
            .select()
            .from(User)
            .where(eq(User.email, profile._json.email as string))
            .limit(1);

          if (userResult && userResult.length > 0) {
            const user = userResult[0];
            logger.info("[GOOGLE] Existing user found", {
              id: user.id,
              loginType: user.loginType,
            });

            if (user.loginType !== "google") {
              return next(
                new ApiError(
                  400,
                  `You registered using ${user.loginType}. Please use that login method.`
                )
              );
            }

            return next(null, user);
          }

          logger.info("[GOOGLE] Creating new user");

          const [createdUser] = await db
            .insert(User)
            .values({
              email: profile._json.email!,
              password: profile._json.sub!,
              username: profile._json.email!.split("@")[0],
              isEmailVerified: true,
              role: "user",
              profilePicture: profile._json.picture,
              loginType: "google",
            })
            .returning();

          if (!createdUser?.id) {
            logger.error("[GOOGLE] User created but ID missing", {
              createdUser,
            });
            return next(new ApiError(500, "User created but ID missing"));
          }

          logger.info("[GOOGLE] User created successfully", {
            id: createdUser.id,
            email: createdUser.email,
          });

          // PostHog "user_registered"
          if (posthog) {
            posthog.capture({
              distinctId: createdUser.id,
              event: "user_registered",
              properties: {
                method: createdUser.loginType,
              },
            });
          }

          next(null, createdUser);
        } catch (err) {
          logger.error("[GOOGLE] OAuth error", { err });
          next(err as Error);
        }
      }
    )
  );
}

// GitHub OAuth strategy (only if configured)
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_CALLBACK_URL) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID!,
        clientSecret: env.GITHUB_CLIENT_SECRET!,
        callbackURL: env.GITHUB_CALLBACK_URL!,
      },
      async (_: any, __: any, profile: any, next: any) => {
        try {
          logger.info("[GITHUB] OAuth callback", {
            email: profile._json.email,
            githubId: profile._json.node_id,
          });

          const userResult = await db
            .select()
            .from(User)
            .where(eq(User.email, profile._json.email as string))
            .limit(1);

          if (userResult && userResult.length > 0) {
            const user = userResult[0];
            logger.info("[GITHUB] Existing user found", {
              id: user.id,
              loginType: user.loginType,
            });

            if (user.loginType !== "github") {
              return next(
                new ApiError(
                  400,
                  `You registered using ${user.loginType}. Please use that login method.`
                )
              );
            }

            return next(null, user);
          }

          logger.info("[GITHUB] Creating new user");

          const [createdUser] = await db
            .insert(User)
            .values({
              email: profile._json.email!,
              password: profile._json.node_id,
              username: profile._json.email!.split("@")[0],
              isEmailVerified: true,
              role: "user",
              profilePicture: profile._json.avatar_url,
              loginType: "github",
            })
            .returning();

          if (!createdUser?.id) {
            logger.error("[GITHUB] User created but ID missing", {
              createdUser,
            });
            return next(new ApiError(500, "User created but ID missing"));
          }

          logger.info("[GITHUB] User created successfully", {
            id: createdUser.id,
            email: createdUser.email,
          });

          // PostHog "user_registered"
          if (posthog) {
            posthog.capture({
              distinctId: createdUser.id,
              event: "user_registered",
              properties: {
                method: createdUser.loginType,
              },
            });
          }

          next(null, createdUser);
        } catch (err) {
          logger.error("[GITHUB] OAuth error", { err });
          next(err as Error);
        }
      }
    )
  );
}

export default passport;
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { ApiError } from "../utils/ApiError";
import { User } from "../db/schema";
import { db } from "../config/db";
import { eq } from "drizzle-orm";
import logger from "../logger/winston.logger";

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

    const user = await db.query.User.findFirst({
      where: eq(User.id, id),
    });

    if (!user) {
      logger.error("[PASSPORT] deserializeUser failed: user not found", {
        id,
      });
      return next(new ApiError(404, "User does not exist"));
    }

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
        "Something went wrong deserializing the user. Error: " + error
      )
    );
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },
    async (_, __, profile, next) => {
      try {
        logger.info("[GOOGLE] OAuth callback received", {
          email: profile._json.email,
          googleId: profile._json.sub,
        });

        const user = await db.query.User.findFirst({
          where: eq(User.email, profile._json.email as string),
        });

        if (user) {
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

        next(null, createdUser);
      } catch (err) {
        logger.error("[GOOGLE] OAuth error", { err });
        next(err as Error);
      }
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: process.env.GITHUB_CALLBACK_URL!,
    },
    async (_, __, profile, next) => {
      try {
        logger.info("[GITHUB] OAuth callback", {
          email: profile._json.email,
          githubId: profile._json.node_id,
        });

        const user = await db.query.User.findFirst({
          where: eq(User.email, profile._json.email as string),
        });

        if (user) {
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
            loginType: "github",
            profilePicture: profile._json.avatar_url,
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

        next(null, createdUser);
      } catch (err) {
        logger.error("[GITHUB] OAuth error", { err });
        next(err as Error);
      }
    }
  )
);

export default passport;

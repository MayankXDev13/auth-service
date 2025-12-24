import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { ApiError } from "../utils/ApiError";
import { User } from "../db/schema";
import { db } from "../config/db";
import { eq, ne } from "drizzle-orm";
import logger from "../logger/winston.logger";

try {
  passport.serializeUser((user, next) => {
    next(null, user);
  });

  passport.deserializeUser(async (id, next) => {
    try {
      const user = await db.query.User.findFirst({
        where: eq(User.id, id as string),
      });

      if (user) next(null, user);
      else next(new ApiError(404, "User does not exist"), null);
    } catch (error) {
      next(
        new ApiError(
          500,
          "Something went wrong deserializing the user. Error: " + error
        ),
        null
      );
    }
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
      },
      async (_, __, profile, next) => {
        logger.info("Google profile: " + JSON.stringify(profile));

        const user = await db.query.User.findFirst({
          where: eq(User.email, profile._json.email as string),
        });

        if (user) {
          if (user.loginType !== "google") {
            return next(
              new ApiError(
                400,
                "You have previously registered using " +
                  user.loginType?.toLowerCase()?.split("_").join(" ") +
                  ". Please use the " +
                  user.loginType?.toLowerCase()?.split("_").join(" ") +
                  " login option to access your account."
              ),
              null
            );
          } else {
            return next(null, user);
          }
        } else {
          const createdUser = await db.insert(User).values({
            email: profile._json.email as string,
            password: profile._json.sub as string,
            username: profile._json.email?.split("@")[0] as string,
            isEmailVerified: true,
            role: "user",
            profilePicture: profile._json.picture,
            loginType: "google",
          });

          if (createdUser) {
            next(null, createdUser);
          } else {
            next(new ApiError(500, "Error while registering the user"), null);
          }
        }
      }
    )
  );

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL,
      },
      async (_, __, profile, next) => {
        logger.info("Github profile: " + JSON.stringify(profile));

        const user = await db.query.User.findFirst({
          where: eq(User.email, profile._json.email as string),
        });

        if (user) {
          if (user.loginType !== "github") {
            next(
              new ApiError(
                400,
                "You have previously registered using " +
                  user.loginType?.toLowerCase()?.split("_").join(" ") +
                  ". Please use the " +
                  user.loginType?.toLowerCase()?.split("_").join(" ") +
                  " login option to access your account."
              ),
              null
            );
          } else {
            next(null, user);
          }
        } else {
          if (!profile._json.email) {
            next(
              new ApiError(
                400,
                "User does not have a public email associated with their account. Please try another login method"
              ),
              null
            );
          } else {
            const userNameExist = await db.query.User.findFirst({
              where: eq(User.username, profile?.username),
            });

            const createdUser = await db.insert(User).values({
              email: profile._json.email as string,
              password: profile._json.node_id as string,
              username: userNameExist
                ? profile._json.email?.split("@")[0]
                : profile?.username,
              isEmailVerified: true,
              role: "user",
              profilePicture: profile._json.avatar_url,
              loginType: "github",
            });

            if (createdUser) {
              next(null, createdUser);
            } else {
              next(new ApiError(500, "Error while registering the user"), null);
            }
          }
        }
      }
    )
  );
} catch (error) {
  console.error("PASSPORT ERROR: ", error);
}

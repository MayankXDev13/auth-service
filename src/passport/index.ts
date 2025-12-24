import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { ApiError } from "../utils/ApiError";
import { User } from "../db/schema";
import { db } from "../config/db";
import { eq } from "drizzle-orm";
import logger from "../logger/winston.logger";

// Serialize
passport.serializeUser((user: any, next) => {
  next(null, user.id);
});

// Deserialize

passport.deserializeUser(async (id: string, next) => {
  try {
    const user = await db.query.User.findFirst({
      where: eq(User.id, id),
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

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
    },
    async (_, __, profile, next) => {
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
        const [createdUser] = await db
          .insert(User)
          .values({
            email: profile._json.email as string,
            password: profile._json.sub as string,
            username: profile._json.email?.split("@")[0] as string,
            isEmailVerified: true,
            role: "user",
            profilePicture: profile._json.picture,
            loginType: "google",
          })
          .returning();

        if (createdUser) {
          logger.info("Created user: ", JSON.stringify(createdUser));
          next(null, createdUser);
        } else {
          next(new ApiError(500, "Error while registering the user"), null);
        }
      }
    }
  )
);

// GitHub Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      callbackURL: process.env.GITHUB_CALLBACK_URL as string,
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
            where: eq(User.username, profile?.username as string),
          });

          const [createdUser] = await db
            .insert(User)
            .values({
              email: profile._json.email!,
              password: profile._json.sub,
              username: profile._json.email!.split("@")[0],
              isEmailVerified: true,
              role: "user",
              loginType: "google",
              profilePicture: profile._json.picture,
            })
            .returning();

          if (createdUser) {
            logger.info("Created user: ", createdUser);
            next(null, createdUser);
          } else {
            next(new ApiError(500, "Error while registering the user"), null);
          }
        }
      }
    }
  )
);

export default passport;

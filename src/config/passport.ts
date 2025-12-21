import passport, { use } from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { db } from "./db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.OAUTH_CALLBACK_URL}/google/callback`,
    },
    async (_, __, profile, next) => {
      try {
        console.log("Profile Google Strategy: ", profile);
        const email = profile.emails?.[0].value;
        if (!email) throw new Error("No email from Google");

        let user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user) {
          [user] = await db
            .insert(users)
            .values({
              email: email,
              name: profile.displayName,
              provider: "google",
              providerId: profile.id,
              isEmailVerified: true,
            })
            .returning();
        }

        next(null, user);
      } catch (error) {
        next(error, undefined);
      }
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: `${process.env.OAUTH_CALLBACK_URL}/github/callback`,
    },
    async (_, __, profile, next) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) throw new Error("No email from GitHub");

        let user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user) {
          [user] = await db
            .insert(users)
            .values({
              email,
              name: profile.username,
              provider: "github",
              providerId: profile.id,
              isEmailVerified: true,
            })
            .returning();
        }

        next(null, user);
      } catch (err) {
        next(err, undefined);
      }
    }
  )
);

export default passport;

import {
  varchar,
  timestamp,
  boolean,
  uuid,
  pgTable,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const User = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 256 }).notNull().unique(),
    username: varchar("username", { length: 256 }),
    password: varchar("password", { length: 256 }),
    loginType: varchar("login_type", { length: 50 })
      .$type<"email_password" | "google" | "github">()
      .default("email_password")
      .notNull(),
    providerId: varchar("provider_id", { length: 256 }),
    profilePicture: varchar("profile_picture", { length: 512 }),
    isEmailVerified: boolean("is_email_verified").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    role: varchar("role", { length: 20 })
      .$type<"admin" | "user">()
      .default("user")
      .notNull(),
    refreshToken: varchar("refresh_token", { length: 512 }),
    forgotPasswordToken: varchar("forgot_password_token", { length: 512 }),
    forgotPasswordTokenExpiresAt: timestamp(
      "forgot_password_token_expires_at",
      {
        mode: "date",
        withTimezone: true,
      }
    ),
    emailVerificationToken: varchar("email_verification_token", {
      length: 512,
    }),
    emailVerificationExpiry: timestamp("email_verification_expiry", {
      mode: "date",
      withTimezone: true,
    }),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("provider_unique_idx").on(table.loginType, table.providerId),
    index("refresh_token_idx").on(table.refreshToken),
    index("forgot_password_token_idx").on(table.forgotPasswordToken),
    index("email_verification_token_idx").on(table.emailVerificationToken),
    // Performance indexes for common queries
    index("users_email_idx").on(table.email),
    index("users_username_idx").on(table.username),
    index("users_login_type_email_idx").on(table.loginType, table.email),
    index("users_active_verified_idx").on(table.isActive, table.isEmailVerified),
  ]
);

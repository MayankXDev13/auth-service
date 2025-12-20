import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const verificationTokens = pgTable("verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  tokenHash: varchar("token_hash", { length: 255 }).notNull(),

  type: varchar("type", { length: 50 }).notNull(), 
  // "email_verification" | "password_reset"

  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

import { pgTable, uuid, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  tokenHash: varchar("token_hash", { length: 255 }).notNull(),

  revoked: boolean("revoked").default(false),

  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

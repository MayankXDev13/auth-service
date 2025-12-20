import { uuid } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { users } from "./users";
import { varchar } from "drizzle-orm/pg-core";
import { timestamp } from "drizzle-orm/pg-core";
import { boolean } from "drizzle-orm/pg-core";

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  revoked: boolean("revoked").default(false).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

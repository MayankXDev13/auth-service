import { varchar } from "drizzle-orm/pg-core";
import { timestamp } from "drizzle-orm/pg-core";
import { boolean } from "drizzle-orm/pg-core";
import { uuid } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  name: varchar("name", { length: 256 }),
  password: varchar("password", { length: 256 }),
  provider: varchar("provider", { length: 50 }).default("local"),
  providerId: varchar("providerId", { length: 256 }),
  isEmailVerified: boolean("is_email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

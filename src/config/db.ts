import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as Schema from "../db/schema";
import { env } from "./env";

// Database connection pool
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const db = drizzle(pool, { schema: Schema });

export { db, pool };

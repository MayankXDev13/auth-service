import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as Schema from "../db/schema";
import { env } from "./env";

// Database connection pool
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false
  },
  // Additional Neon PostgreSQL settings
  application_name: "auth-service"
});

const db = drizzle(pool, { schema: Schema });

export { db, pool };

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as Schema from "../db/schema"

const db = drizzle(process.env.DATABASE_URL!, {schema: Schema});

export { db };

import { eq, or, and, gt, ne } from 'drizzle-orm';
import type { UserRepository, CreateUserInput } from '../ports';
import { User } from '../../../db/schema';
import type { db as DbType } from '../../../config/db';
import { pool } from '../../../config/db';

type Db = typeof DbType;

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async init(): Promise<void> {
    await pool.query('SELECT 1');
  }

  async close(): Promise<void> {
    // pool is shared singleton — do not end here unless explicitly managing lifecycle
    // caller (bootstrap) will handle close
  }

  async findById(id: string) {
    const user = await this.db.query.User.findFirst({ where: eq(User.id, id) });
    return user ?? null;
  }

  async findByEmail(email: string) {
    const user = await this.db.query.User.findFirst({ where: eq(User.email, email) });
    return user ?? null;
  }

  async findByEmailOrUsername(email?: string, username?: string) {
    if (!email && !username) return null;
    const user = await this.db.query.User.findFirst({
      where: or(eq(User.email, email || ''), eq(User.username, username || '')),
    });
    return user ?? null;
  }

  async findUniqueByEmailOrUsername(email: string, username: string) {
    const user = await this.db.query.User.findFirst({
      where: or(eq(User.email, email), eq(User.username, username)),
    });
    return user ?? null;
  }

  async findByVerificationToken(hashedToken: string) {
    const user = await this.db.query.User.findFirst({
      where: and(eq(User.emailVerificationToken, hashedToken), gt(User.emailVerificationExpiry, new Date())),
    } as any);
    return user ?? null;
  }

  async findByForgotToken(hashedToken: string) {
    const user = await this.db.query.User.findFirst({
      where: and(eq(User.forgotPasswordToken, hashedToken), gt(User.forgotPasswordTokenExpiresAt, new Date())),
    } as any);
    return user ?? null;
  }

  async create(data: CreateUserInput) {
    const [user] = await this.db.insert(User).values(data).returning();
    return user;
  }

  async update(id: string, patch: Partial<typeof User.$inferSelect>) {
    const [user] = await this.db.update(User).set(patch).where(eq(User.id, id)).returning();
    return user;
  }
}

// Also used for username uniqueness check that excludes self
export async function findByUsernameExcludingId(db: Db, username: string, excludeId: string) {
  const user = await db.query.User.findFirst({
    where: and(eq(User.username, username), ne(User.id, excludeId)),
  });
  return user ?? null;
}

import type { User } from '../../db/schema';

export type PublicUser = Pick<
  typeof User.$inferSelect,
  'id' | 'email' | 'username' | 'role' | 'profilePicture' | 'isEmailVerified' | 'lastLoginAt' | 'createdAt'
>;

export type CreateUserInput = typeof User.$inferInsert;

export interface UserRepository {
  findById(id: string): Promise<(typeof User.$inferSelect) | null>;
  findByEmail(email: string): Promise<(typeof User.$inferSelect) | null>;
  findByEmailOrUsername(email?: string, username?: string): Promise<(typeof User.$inferSelect) | null>;
  findUniqueByEmailOrUsername(email: string, username: string): Promise<(typeof User.$inferSelect) | null>;
  findByVerificationToken(hashedToken: string): Promise<(typeof User.$inferSelect) | null>;
  findByForgotToken(hashedToken: string): Promise<(typeof User.$inferSelect) | null>;
  create(data: CreateUserInput): Promise<typeof User.$inferSelect>;
  update(id: string, patch: Partial<typeof User.$inferSelect>): Promise<typeof User.$inferSelect>;
  findByIdWithColumns?(id: string, columns: Record<string, boolean>): Promise<Partial<typeof User.$inferSelect> | null>;
}

export interface EmailPort {
  send(opts: { to: string; subject: string; html: string; text: string }): Promise<{ id: string }>;
}

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  setex<T>(key: string, ttlSec: number, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

export interface ObjectStoragePort {
  upload(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}

export interface AnalyticsPort {
  capture(event: { distinctId: string; event: string; properties?: Record<string, unknown> }): void;
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  randomBytes(n: number): Buffer;
}

export interface PasswordHasher {
  hash(pw: string): Promise<string>;
  compare(pw: string, hash: string): Promise<boolean>;
}

export interface TokenSigner {
  signAccessToken(payload: { userId: string; email: string; username: string | null; role: string }): string;
  signRefreshToken(payload: { userId: string }): string;
  verifyAccessToken(token: string): { userId: string; email: string; username: string | null; role: string };
  verifyRefreshToken(token: string): { userId: string };
}

export type Tokens = { accessToken: string; refreshToken: string };

export type AuthConfig = {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  clientSsoRedirectUrl: string;
  forgotPasswordRedirectUrl: string;
  s3Bucket: string;
  s3Region: string;
  s3ProfilePicsPrefix: string;
  resendFromEmail: string;
};

export type AuthPorts = {
  users: UserRepository;
  email: EmailPort;
  cache: CachePort;
  storage: ObjectStoragePort;
  analytics: AnalyticsPort;
  tokens: TokenSigner;
  hasher: PasswordHasher;
  clock: Clock;
  ids: IdGenerator;
};

export interface ManagedAdapter {
  init?(): Promise<void>;
  close?(): Promise<void>;
}

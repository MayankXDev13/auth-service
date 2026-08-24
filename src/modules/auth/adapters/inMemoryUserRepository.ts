import type { UserRepository, CreateUserInput } from '../ports';
import type { User } from '../../../db/schema';
import crypto from 'crypto';

type UserRow = typeof User.$inferSelect;

export class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, UserRow>();

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: string) {
    for (const u of this.store.values()) if (u.email === email) return u;
    return null;
  }

  async findByEmailOrUsername(email?: string, username?: string) {
    for (const u of this.store.values()) {
      if ((email && u.email === email) || (username && u.username === username)) return u;
    }
    return null;
  }

  async findUniqueByEmailOrUsername(email: string, username: string) {
    for (const u of this.store.values()) if (u.email === email || u.username === username) return u;
    return null;
  }

  async findByVerificationToken(hashedToken: string) {
    const now = new Date();
    for (const u of this.store.values()) {
      if (u.emailVerificationToken === hashedToken && u.emailVerificationExpiry && u.emailVerificationExpiry > now) return u;
    }
    return null;
  }

  async findByForgotToken(hashedToken: string) {
    const now = new Date();
    for (const u of this.store.values()) {
      if (u.forgotPasswordToken === hashedToken && u.forgotPasswordTokenExpiresAt && u.forgotPasswordTokenExpiresAt > now) return u;
    }
    return null;
  }

  async create(data: CreateUserInput) {
    const id = (data as any).id || crypto.randomUUID();
    const now = new Date();
    const row: UserRow = {
      id,
      email: (data as any).email,
      username: (data as any).username ?? null,
      password: (data as any).password ?? null,
      loginType: (data as any).loginType ?? 'email_password',
      providerId: (data as any).providerId ?? null,
      profilePicture: (data as any).profilePicture ?? null,
      isEmailVerified: (data as any).isEmailVerified ?? false,
      isActive: (data as any).isActive ?? true,
      role: (data as any).role ?? 'user',
      refreshToken: (data as any).refreshToken ?? null,
      forgotPasswordToken: (data as any).forgotPasswordToken ?? null,
      forgotPasswordTokenExpiresAt: (data as any).forgotPasswordTokenExpiresAt ?? null,
      emailVerificationToken: (data as any).emailVerificationToken ?? null,
      emailVerificationExpiry: (data as any).emailVerificationExpiry ?? null,
      lastLoginAt: (data as any).lastLoginAt ?? null,
      createdAt: now,
      updatedAt: now,
    } as any;
    this.store.set(id, row);
    return row;
  }

  async update(id: string, patch: Partial<UserRow>) {
    const existing = this.store.get(id);
    if (!existing) throw new Error('User not found');
    const updated = { ...existing, ...patch, updatedAt: new Date() } as UserRow;
    this.store.set(id, updated);
    return updated;
  }

  // test helper
  clear() {
    this.store.clear();
  }

  get all() {
    return [...this.store.values()];
  }
}

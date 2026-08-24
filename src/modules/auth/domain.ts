import crypto from 'crypto';
import type { AuthPorts, AuthConfig, PublicUser } from './ports';
import { AuthError } from './errors';
import logger from '../../logger/winston.logger';
import { emailVerificationMailgenContent, forgotPasswordMailgenContent } from '../../utils/mailTemplates';
import Mailgen from 'mailgen';

export type Tokens = { accessToken: string; refreshToken: string };

// Canonical token utilities — single source, fixes duplication
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateTemporaryToken(ids: { randomBytes(n: number): Buffer }, clock: { now(): Date }) {
  const unHashedToken = ids.randomBytes(32).toString('hex');
  const hashedToken = hashToken(unHashedToken);
  const USER_TEMPORARY_TOKEN_EXPIRY = 20 * 60 * 1000; // 20 minutes
  const tokenExpiry = new Date(clock.now().getTime() + USER_TEMPORARY_TOKEN_EXPIRY);
  return { hashedToken, unHashedToken, tokenExpiry };
}

function pickPublicUser(u: any): PublicUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    profilePicture: u.profilePicture,
    isEmailVerified: u.isEmailVerified,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  } as PublicUser;
}

const mailGenerator = new Mailgen({
  theme: 'default',
  product: { name: 'FreeAPI', link: 'https://freeapi.app' },
});

export class AuthDomain {
  constructor(
    private readonly config: AuthConfig,
    private readonly ports: AuthPorts
  ) {}

  async init(): Promise<void> {
    // adapters may have init hooks; call them if present
    for (const key of ['users', 'email', 'cache', 'storage', 'analytics'] as const) {
      const adapter: any = (this.ports as any)[key];
      if (adapter?.init) await adapter.init();
    }
  }

  async close(): Promise<void> {
    for (const key of ['users', 'email', 'cache', 'storage', 'analytics'] as const) {
      const adapter: any = (this.ports as any)[key];
      if (adapter?.close) await adapter.close();
    }
  }

  // ── Registration ──────────────────────────────────────────────────
  async register(input: { email: string; username: string; password: string; host: string; protocol: string }): Promise<{ userId: string }> {
    const { email, username, password, host, protocol } = input;

    const existed = await this.ports.users.findUniqueByEmailOrUsername(email, username);
    if (existed) throw new AuthError('USER_EXISTS', 'User with given email or username already exists');

    const { hashedToken, unHashedToken, tokenExpiry } = generateTemporaryToken(this.ports.ids, this.ports.clock);
    const hashPassword = await this.ports.hasher.hash(password);

    const user = await this.ports.users.create({
      email,
      username,
      password: hashPassword,
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: tokenExpiry,
      loginType: 'email_password',
    } as any);

    if (!user) throw new AuthError('USER_NOT_FOUND', 'Failed to register user');

    const verificationUrl = `${protocol}://${host}/api/v1/users/verify-email/${unHashedToken}`;
    const mailContent = emailVerificationMailgenContent(username, verificationUrl);
    const html = mailGenerator.generate(mailContent);
    const text = mailGenerator.generatePlaintext(mailContent);

    try {
      await this.ports.email.send({ to: user.email, subject: 'Please verify your email', html, text });
    } catch (e) {
      logger.error('Failed to send verification email', { error: e, userId: user.id });
      // do not fail registration if email fails — user can resend
    }

    this.ports.analytics.capture({ distinctId: user.id, event: 'user_registered', properties: { method: user.loginType } });

    return { userId: user.id };
  }

  // ── Verify Email ──────────────────────────────────────────────────
  async verifyEmail(token: string): Promise<{ isEmailVerified: true }> {
    if (!token) throw new AuthError('INVALID_TOKEN', 'Email verification token is missing');
    const hashedToken = hashToken(token);
    const user = await this.ports.users.findByVerificationToken(hashedToken);
    if (!user) throw new AuthError('TOKEN_INVALID_OR_EXPIRED', 'Token is invalid or expired');

    // check expiry explicitly (findByVerificationToken already does gt check in Drizzle impl; in-memory must check)
    if (user.emailVerificationExpiry && user.emailVerificationExpiry < this.ports.clock.now()) {
      throw new AuthError('TOKEN_INVALID_OR_EXPIRED', 'Token is invalid or expired');
    }

    await this.ports.users.update(user.id, {
      isEmailVerified: true,
      emailVerificationToken: null as any,
      emailVerificationExpiry: null as any,
    });

    this.ports.analytics.capture({ distinctId: user.id, event: 'email_verified' });
    return { isEmailVerified: true };
  }

  async resendVerification(userId: string, host: string, protocol: string): Promise<void> {
    const user = await this.ports.users.findById(userId);
    if (!user) throw new AuthError('USER_NOT_FOUND', 'User does not exist');
    if (user.isEmailVerified) throw new AuthError('EMAIL_ALREADY_VERIFIED', 'Email is already verified!');

    const { hashedToken, unHashedToken, tokenExpiry } = generateTemporaryToken(this.ports.ids, this.ports.clock);
    await this.ports.users.update(user.id, {
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: tokenExpiry,
    } as any);

    const verificationUrl = `${protocol}://${host}/api/v1/users/verify-email/${unHashedToken}`;
    const mailContent = emailVerificationMailgenContent(user.username!, verificationUrl);
    const html = mailGenerator.generate(mailContent);
    const text = mailGenerator.generatePlaintext(mailContent);
    await this.ports.email.send({ to: user.email, subject: 'Please verify your email', html, text });

    this.ports.analytics.capture({ distinctId: user.id, event: 'resend_email_verification' });
  }

  // ── Login / Logout ────────────────────────────────────────────────
  async login(input: { email?: string; username?: string; password: string }): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const { email, username, password } = input;
    if (!email && !username) throw new AuthError('VALIDATION_FAILED', 'Username or email is required to login');

    const user = await this.ports.users.findByEmailOrUsername(email, username);
    if (!user) throw new AuthError('USER_NOT_FOUND', 'User does not exist');

    if (!user.isActive) throw new AuthError('ACCOUNT_DEACTIVATED', 'Account is deactivated');

    const isValid = await this.ports.hasher.compare(password, user.password || '');
    if (!isValid) throw new AuthError('INVALID_CREDENTIALS', 'Invalid user credentials');

    const accessToken = this.ports.tokens.signAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });
    const refreshToken = this.ports.tokens.signRefreshToken({ userId: user.id });

    await this.ports.users.update(user.id, { refreshToken } as any);

    // fetch public profile (reuse getCurrentUser cache path but bypass cache for login)
    const publicUser = pickPublicUser(user);

    this.ports.analytics.capture({ distinctId: user.id, event: 'user_logged_in', properties: { method: 'password' } });

    return { user: publicUser, accessToken, refreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.ports.users.update(userId, { refreshToken: null } as any);
    // invalidate cache
    await this.ports.cache.del(`user:${userId}`).catch(() => {});
    this.ports.analytics.capture({ distinctId: userId, event: 'user_logged_out' });
  }

  // ── Refresh ───────────────────────────────────────────────────────
  async refreshAccessToken(incomingToken: string): Promise<Tokens> {
    if (!incomingToken) throw new AuthError('UNAUTHORIZED', 'Refresh token is missing');

    let decoded: { userId: string };
    try {
      decoded = this.ports.tokens.verifyRefreshToken(incomingToken);
    } catch {
      throw new AuthError('INVALID_TOKEN', 'Invalid or expired refresh token');
    }

    const user = await this.ports.users.findById(decoded.userId);
    if (!user) throw new AuthError('INVALID_TOKEN', 'Invalid refresh token');

    if (incomingToken !== user.refreshToken) {
      throw new AuthError('INVALID_TOKEN', 'Refresh token is expired or used');
    }

    const accessToken = this.ports.tokens.signAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });
    const newRefreshToken = this.ports.tokens.signRefreshToken({ userId: user.id });

    // Fix: previously missing .where() updated all rows
    await this.ports.users.update(user.id, { refreshToken: newRefreshToken } as any);

    this.ports.analytics.capture({ distinctId: user.id, event: 'access_token_refreshed' });

    return { accessToken, refreshToken: newRefreshToken };
  }

  // ── Social Login ──────────────────────────────────────────────────
  async handleSocialLogin(userId: string): Promise<{ accessToken: string; refreshToken: string; redirectUrl: string }> {
    const user = await this.ports.users.findById(userId);
    if (!user) throw new AuthError('USER_NOT_FOUND', 'User does not exist');

    const accessToken = this.ports.tokens.signAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });
    const refreshToken = this.ports.tokens.signRefreshToken({ userId: user.id });
    await this.ports.users.update(user.id, { refreshToken } as any);

    this.ports.analytics.capture({ distinctId: user.id, event: 'user_logged_in', properties: { method: user.loginType } });

    return { accessToken, refreshToken, redirectUrl: this.config.clientSsoRedirectUrl };
  }

  // ── Password flows ────────────────────────────────────────────────
  async forgotPasswordRequest(email: string): Promise<void> {
    const user = await this.ports.users.findByEmail(email);
    if (!user) throw new AuthError('USER_NOT_FOUND', 'User does not exists');

    const { hashedToken, unHashedToken, tokenExpiry } = generateTemporaryToken(this.ports.ids, this.ports.clock);
    await this.ports.users.update(user.id, {
      forgotPasswordToken: hashedToken,
      forgotPasswordTokenExpiresAt: tokenExpiry,
    } as any);

    const resetUrl = `${this.config.forgotPasswordRedirectUrl}/${unHashedToken}`;
    const mailContent = forgotPasswordMailgenContent(user.username!, resetUrl);
    const html = mailGenerator.generate(mailContent);
    const text = mailGenerator.generatePlaintext(mailContent);
    await this.ports.email.send({ to: user.email, subject: 'Password reset request', html, text });

    this.ports.analytics.capture({ distinctId: user.id, event: 'password_reset_requested' });
  }

  async resetForgottenPassword(resetToken: string, newPassword: string): Promise<void> {
    const hashedToken = hashToken(resetToken);
    const user = await this.ports.users.findByForgotToken(hashedToken);
    if (!user) throw new AuthError('TOKEN_INVALID_OR_EXPIRED', 'Token is invalid or expired');

    // expiry check for in-memory path
    if (user.forgotPasswordTokenExpiresAt && user.forgotPasswordTokenExpiresAt < this.ports.clock.now()) {
      throw new AuthError('TOKEN_INVALID_OR_EXPIRED', 'Token is invalid or expired');
    }

    const isSame = await this.ports.hasher.compare(newPassword, user.password!);
    if (isSame) throw new AuthError('SAME_PASSWORD', 'New password cannot be same as old password');

    const hashPassword = await this.ports.hasher.hash(newPassword);
    await this.ports.users.update(user.id, {
      password: hashPassword,
      forgotPasswordToken: null as any,
      forgotPasswordTokenExpiresAt: null as any,
    } as any);

    this.ports.analytics.capture({ distinctId: user.id, event: 'password_reset_completed' });
  }

  async changeCurrentPassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.ports.users.findById(userId);
    if (!user) throw new AuthError('USER_NOT_FOUND', 'User does not exist');

    const isValid = await this.ports.hasher.compare(oldPassword, user.password!);
    if (!isValid) throw new AuthError('INVALID_OLD_PASSWORD', 'Invalid old password');

    const isSame = await this.ports.hasher.compare(newPassword, user.password!);
    if (isSame) throw new AuthError('SAME_PASSWORD', 'New password cannot be same as old password');

    const hashPassword = await this.ports.hasher.hash(newPassword);
    await this.ports.users.update(userId, { password: hashPassword } as any);

    this.ports.analytics.capture({ distinctId: userId, event: 'password_changed' });
  }

  // ── Profile ───────────────────────────────────────────────────────
  async getCurrentUser(userId: string): Promise<PublicUser> {
    const cached = await this.ports.cache.get<PublicUser>(`user:${userId}`).catch(() => null);
    if (cached) {
      logger.info('Current user cache hit', { userId });
      return cached;
    }

    const user = await this.ports.users.findById(userId);
    if (!user) throw new AuthError('USER_NOT_FOUND', 'User not found');

    const publicUser = pickPublicUser(user);
    await this.ports.cache.setex(`user:${userId}`, 1800, publicUser).catch(e => logger.warn('Cache set failed', { error: e }));
    logger.info('Current user fetched', { userId });
    return publicUser;
  }

  async updateUsername(userId: string, username: string): Promise<{ username: string }> {
    // check taken
    const existing = await this.ports.users.findByEmailOrUsername(undefined, username);
    // findByEmailOrUsername may return self; need to disambiguate
    if (existing && existing.id !== userId) throw new AuthError('USERNAME_TAKEN', 'Username is already taken');
    // Also check via direct query for username uniqueness (more precise)
    // fallback: if existing is self, allow update
    await this.ports.users.update(userId, { username } as any);
    await this.ports.cache.del(`user:${userId}`).catch(() => {});
    this.ports.analytics.capture({ distinctId: userId, event: 'username_updated' });
    return { username };
  }

  async uploadProfilePicture(userId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<{ profilePicture: string }> {
    const { buffer, mimetype, originalname } = file;
    if (!mimetype.startsWith('image/')) throw new AuthError('INVALID_FILE_TYPE', 'Invalid file type: only images allowed');
    if (buffer.length > 5 * 1024 * 1024) throw new AuthError('FILE_TOO_LARGE', 'File too large: max 5MB');

    const current = await this.ports.users.findById(userId);
    const oldUrl = (current as any)?.profilePicture as string | null;

    const extension = mimetype.split('/')[1] || 'jpg';
    const sanitizedName = originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${this.config.s3ProfilePicsPrefix}${userId}/${sanitizedName}-${Date.now()}.${extension}`;

    try {
      const { url } = await this.ports.storage.upload(key, buffer, mimetype);

      if (oldUrl && oldUrl.includes(this.config.s3Bucket)) {
        try {
          const oldKey = oldUrl.split('/').slice(3).join('/');
          await this.ports.storage.delete(oldKey);
        } catch (e) {
          logger.warn('Failed to delete old avatar', { error: e });
        }
      }

      await this.ports.users.update(userId, { profilePicture: url } as any);
      await this.ports.cache.del(`user:${userId}`).catch(() => {});
      this.ports.analytics.capture({ distinctId: userId, event: 'profile_picture_uploaded' });
      return { profilePicture: url };
    } catch (e: any) {
      logger.error('Profile picture upload error', { error: e.message });
      if (e instanceof AuthError) throw e;
      throw new AuthError('VALIDATION_FAILED', e.message || 'Upload failed');
    }
  }

  // ── Admin ─────────────────────────────────────────────────────────
  async assignRole(actorId: string, targetUserId: string, role: 'admin' | 'user'): Promise<void> {
    const user = await this.ports.users.findById(targetUserId);
    if (!user) throw new AuthError('USER_NOT_FOUND', 'User does not exist');
    await this.ports.users.update(targetUserId, { role } as any);
    this.ports.analytics.capture({ distinctId: targetUserId, event: 'user_role_changed', properties: { role } });
  }

  // ── Authentication (replaces verifyJWT) ───────────────────────────
  async authenticate(token: string): Promise<PublicUser> {
    if (!token) throw new AuthError('UNAUTHORIZED', 'Unauthorized request');
    let decoded: { userId: string };
    try {
      decoded = this.ports.tokens.verifyAccessToken(token);
    } catch (e: any) {
      if (e?.name === 'TokenExpiredError') throw new AuthError('TOKEN_EXPIRED', 'Access token expired');
      throw new AuthError('INVALID_TOKEN', 'Invalid access token');
    }
    const user = await this.ports.users.findById(decoded.userId);
    if (!user) throw new AuthError('INVALID_TOKEN', 'Invalid access token');
    return pickPublicUser(user);
  }
}

export function createAuthDomain(config: AuthConfig, ports: AuthPorts): AuthDomain {
  return new AuthDomain(config, ports);
}

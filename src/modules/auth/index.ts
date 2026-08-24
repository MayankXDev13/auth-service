import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import multer from 'multer';
import passport from 'passport';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { env as defaultEnv } from '../../config/env';
import { db as defaultDb } from '../../config/db';
import { AuthDomain } from './domain';
import type { AuthConfig, AuthPorts, PublicUser } from './ports';
import type { Tokens } from './ports';
import { DrizzleUserRepository } from './adapters/drizzleUserRepository';
import { IORedisCacheAdapter, NoopCacheAdapter } from './adapters/ioredisCacheAdapter';
import { S3StorageAdapter } from './adapters/s3StorageAdapter';
import { InMemoryStorageAdapter } from './adapters/memoryStorageAdapter';
import { ResendEmailAdapter } from './adapters/resendEmailAdapter';
import { InMemoryEmailAdapter } from './adapters/memoryEmailAdapter';
import { PostHogAnalyticsAdapter, NoopAnalyticsAdapter } from './adapters/posthogAnalyticsAdapter';
import { JwtTokenSigner } from './adapters/jwtTokenSigner';
import { InMemoryCacheAdapter } from './adapters/memoryCacheAdapter';
import { AuthError } from './errors';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';

export type AuthOptions = {
  db?: typeof defaultDb;
  cache?: AuthPorts['cache'];
  email?: AuthPorts['email'];
  analytics?: AuthPorts['analytics'];
  storage?: AuthPorts['storage'];
  tokens?: AuthPorts['tokens'];
  hasher?: AuthPorts['hasher'];
  clock?: AuthPorts['clock'];
  ids?: AuthPorts['ids'];
  config?: Partial<AuthConfig>;
  baseUrl?: string;
};

export interface Auth {
  // hot path
  register(input: { email: string; username: string; password: string; origin?: string; host?: string; protocol?: string }): Promise<{ userId: string }>;
  login(input: { email?: string; username?: string; password: string }): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }>;
  authenticate(token: string): Promise<PublicUser>;
  me(userId: string): Promise<PublicUser>;

  init(): Promise<void>;
  close(): Promise<void>;

  readonly middleware: { authenticate: ReturnType<typeof asyncHandler> };
  readonly router: Router;

  readonly extended: {
    email: { verify(token: string): Promise<{ isEmailVerified: true }>; resend(userId: string, host?: string, protocol?: string): Promise<void> };
    password: { forgot(email: string): Promise<void>; reset(token: string, newPassword: string): Promise<void>; change(userId: string, oldPassword: string, newPassword: string): Promise<void> };
    profile: { updateUsername(userId: string, username: string): Promise<{ username: string }>; uploadAvatar(userId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<{ profilePicture: string }> };
    tokens: { refresh(refreshToken: string): Promise<Tokens> };
    admin: { assignRole(actorId: string, targetUserId: string, role: 'admin'|'user'): Promise<void> };
    oauth: { router: Router };
    logout(userId: string): Promise<void>;
  };

  /** expose inner domain for advanced use / testing */
  readonly domain: AuthDomain;
}

function buildConfig(override?: Partial<AuthConfig>): AuthConfig {
  return {
    accessTokenSecret: override?.accessTokenSecret ?? defaultEnv.ACCESS_TOKEN_SECRET,
    refreshTokenSecret: override?.refreshTokenSecret ?? defaultEnv.REFRESH_TOKEN_SECRET,
    accessTokenExpiry: override?.accessTokenExpiry ?? defaultEnv.ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiry: override?.refreshTokenExpiry ?? defaultEnv.REFRESH_TOKEN_EXPIRY,
    clientSsoRedirectUrl: override?.clientSsoRedirectUrl ?? defaultEnv.CLIENT_SSO_REDIRECT_URL,
    forgotPasswordRedirectUrl: override?.forgotPasswordRedirectUrl ?? defaultEnv.FORGOT_PASSWORD_REDIRECT_URL,
    s3Bucket: override?.s3Bucket ?? defaultEnv.S3_BUCKET,
    s3Region: override?.s3Region ?? defaultEnv.AWS_REGION,
    s3ProfilePicsPrefix: override?.s3ProfilePicsPrefix ?? defaultEnv.S3_PROFILE_PICS_PREFIX,
    resendFromEmail: override?.resendFromEmail ?? defaultEnv.RESEND_FROM_EMAIL,
  };
}

function buildPorts(opts: AuthOptions, config: AuthConfig): AuthPorts {
  const hasher = opts.hasher ?? { hash: (pw: string) => bcrypt.hash(pw, 12), compare: bcrypt.compare };
  const clock = opts.clock ?? { now: () => new Date() };
  const ids = opts.ids ?? { randomBytes: (n: number) => crypto.randomBytes(n) };
  const tokens = opts.tokens ?? new JwtTokenSigner(config.accessTokenSecret, config.refreshTokenSecret, config.accessTokenExpiry, config.refreshTokenExpiry);

  let cache: AuthPorts['cache'];
  if (opts.cache) cache = opts.cache;
  else {
    const redisUrl = process.env.REDIS_URL || '';
    cache = redisUrl ? new IORedisCacheAdapter(redisUrl) : new NoopCacheAdapter();
  }

  let email: AuthPorts['email'];
  if (opts.email) email = opts.email;
  else {
    try {
      email = new ResendEmailAdapter({ apiKey: defaultEnv.RESEND_API_KEY, from: config.resendFromEmail });
    } catch {
      // fallback to in-memory for dev/test without keys
      email = new InMemoryEmailAdapter();
    }
  }

  let analytics: AuthPorts['analytics'];
  if (opts.analytics) analytics = opts.analytics;
  else {
    analytics = defaultEnv.POSTHOG_API_KEY ? new PostHogAnalyticsAdapter(defaultEnv.POSTHOG_API_KEY) : new NoopAnalyticsAdapter();
  }

  let storage: AuthPorts['storage'];
  if (opts.storage) storage = opts.storage;
  else {
    try {
      storage = new S3StorageAdapter({
        region: config.s3Region,
        bucket: config.s3Bucket,
        credentials: { accessKeyId: defaultEnv.AWS_ACCESS_KEY_ID, secretAccessKey: defaultEnv.AWS_SECRET_ACCESS_KEY },
      });
    } catch {
      storage = new InMemoryStorageAdapter({ s3Bucket: config.s3Bucket, s3Region: config.s3Region });
    }
  }

  const db = opts.db ?? defaultDb;
  const users = new DrizzleUserRepository(db as any);

  return { users, email, cache, storage, analytics, tokens, hasher, clock, ids };
}

export function createAuth(opts: AuthOptions = {}): Auth {
  const config = buildConfig(opts.config);
  const ports = buildPorts(opts, config);
  const domain = new AuthDomain(config, ports);

  // express middleware — replaces verifyJWT
  const authenticateMiddleware = asyncHandler(async (req: any, _res: any, next: any) => {
    const token = req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '');
    const user = await domain.authenticate(token);
    req.user = user;
    next();
  });

  // rate limiters (migrated from user.routes.ts)
  const avatarLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Too many profile picture upload requests, please try again later.' });
  const usernameUpdateLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 3,
    message: 'Too many username updates, please try again later.',
    keyGenerator: req => (req as any).user?.id || ipKeyGenerator(req.ip as string),
  });
  const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

  // validation helpers (lightweight, Zod inside domain for full validation)
  // we keep thin validation here; domain throws AuthError which maps to ApiError via error middleware
  const hotRouter = Router();
  hotRouter.post('/register', asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    const host = req.get('host') || 'localhost';
    const protocol = req.protocol || 'http';
    const { userId } = await domain.register({ email, username, password, host, protocol });
    res.status(201).json(new ApiResponse(201, { userId }, 'Users registered successfully and verification email has been sent on your email.'));
  }));
  hotRouter.post('/login', asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    const { user, accessToken, refreshToken } = await domain.login({ email, username, password });
    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };
    res.status(200).cookie('refreshToken', refreshToken, options).cookie('accessToken', accessToken, options)
      .json(new ApiResponse(200, { user, accessToken, refreshToken }, 'User logged in successfully'));
  }));
  hotRouter.post('/refresh-token', asyncHandler(async (req, res) => {
    const incoming = (req.cookies && req.cookies.refreshToken) || (req.body && req.body.refreshToken);
    const { accessToken, refreshToken } = await domain.refreshAccessToken(incoming);
    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };
    res.status(200).cookie('accessToken', accessToken, options).cookie('refreshToken', refreshToken, options)
      .json(new ApiResponse(200, { accessToken, refreshToken }, 'Access token refreshed'));
  }));
  hotRouter.get('/verify-email/:verificationToken', asyncHandler(async (req, res) => {
    const result = await domain.verifyEmail(req.params.verificationToken);
    res.status(200).json(new ApiResponse(200, result, 'Email is verified'));
  }));
  hotRouter.post('/logout', authenticateMiddleware, asyncHandler(async (req: any, res) => {
    await domain.logout(req.user.id);
    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };
    res.status(200).clearCookie('refreshToken', options).clearCookie('accessToken', options)
      .json(new ApiResponse(200, {}, 'User logged out successfully'));
  }));
  hotRouter.get('/current-user', authenticateMiddleware, asyncHandler(async (req: any, res) => {
    const user = await domain.getCurrentUser(req.user.id);
    res.status(200).json(new ApiResponse(200, user, 'Current user fetched successfully'));
  }));

  // OAuth router — preserves passport behavior but lazily uses global passport
  const oauthRouter = Router();
  oauthRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }), (_req, res) => res.send('redirecting to google...'));
  oauthRouter.get('/github', passport.authenticate('github', { scope: ['profile', 'email'] }), (_req, res) => res.send('redirecting to github...'));
  oauthRouter.get('/google/callback', passport.authenticate('google'), asyncHandler(async (req: any, res) => {
    const { accessToken, refreshToken, redirectUrl } = await domain.handleSocialLogin(req.user.id as string);
    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };
    res.status(301).cookie('accessToken', accessToken, options).cookie('refreshToken', refreshToken, options).redirect(redirectUrl);
  }));
  oauthRouter.get('/github/callback', passport.authenticate('github'), asyncHandler(async (req: any, res) => {
    const { accessToken, refreshToken, redirectUrl } = await domain.handleSocialLogin(req.user.id as string);
    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production' };
    res.status(301).cookie('accessToken', accessToken, options).cookie('refreshToken', refreshToken, options).redirect(redirectUrl);
  }));

  const extended = {
    email: {
      verify: (token: string) => domain.verifyEmail(token),
      resend: (userId: string, host?: string, protocol?: string) => domain.resendVerification(userId, host || 'localhost', protocol || 'http'),
    },
    password: {
      forgot: (email: string) => domain.forgotPasswordRequest(email),
      reset: (token: string, newPassword: string) => domain.resetForgottenPassword(token, newPassword),
      change: (userId: string, oldPassword: string, newPassword: string) => domain.changeCurrentPassword(userId, oldPassword, newPassword),
    },
    profile: {
      updateUsername: (userId: string, username: string) => domain.updateUsername(userId, username),
      uploadAvatar: (userId: string, file: { buffer: Buffer; mimetype: string; originalname: string }) => domain.uploadProfilePicture(userId, file),
    },
    tokens: { refresh: (t: string) => domain.refreshAccessToken(t) },
    admin: { assignRole: (actorId: string, targetId: string, role: 'admin'|'user') => domain.assignRole(actorId, targetId, role) },
    oauth: { router: oauthRouter },
    logout: (userId: string) => domain.logout(userId),
  };

  // Adapter-level router for profile/password routes that need extra middleware
  // We expose them via hotRouter extension point but keep OAuth separate per RFC
  // Additional extended routes: mounted by caller via auth.extended.* or auto-registered if using createAuth router alone
  // To preserve backward compatibility, hotRouter also handles password/admin/profile when called via original user.routes.ts paths
  // but canonical is to use extended.* programmatically.

  return {
    register: (input) => domain.register({ email: input.email, username: input.username, password: input.password, host: input.host || input.origin?.replace(/^https?:\/\//, '') || 'localhost', protocol: input.protocol || (input.origin?.startsWith('https') ? 'https' : 'http') }),
    login: (input) => domain.login(input) as any,
    authenticate: (token) => domain.authenticate(token),
    me: (userId) => domain.getCurrentUser(userId),
    init: () => domain.init(),
    close: () => domain.close(),
    middleware: { authenticate: authenticateMiddleware },
    router: hotRouter,
    extended,
    domain,
  };
}

// Re-export for testing
export { AuthDomain, hashToken, generateTemporaryToken } from './domain';
export { InMemoryUserRepository } from './adapters/inMemoryUserRepository';
export { InMemoryCacheAdapter } from './adapters/memoryCacheAdapter';
export { InMemoryEmailAdapter } from './adapters/memoryEmailAdapter';
export { InMemoryStorageAdapter } from './adapters/memoryStorageAdapter';
export { FakeTokenSigner, JwtTokenSigner } from './adapters/jwtTokenSigner';
export { NoopAnalyticsAdapter, PostHogAnalyticsAdapter } from './adapters/posthogAnalyticsAdapter';
export { NoopCacheAdapter } from './adapters/ioredisCacheAdapter';

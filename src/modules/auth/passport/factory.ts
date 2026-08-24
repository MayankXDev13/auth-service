/**
 * Deep Passport factory — hides OAuth vendor differences, lifecycle, and side-effects.
 * Previously: src/passport/index.ts 311 LoC side-effect module `import './passport/index'` in app.ts:10,
 * 70% duplication between Google (85 LoC) and GitHub (85 LoC) verify callbacks, global `passport.use` at import time,
 * concrete `db`/`env`/`posthog` imports, untestable without live DB+OAuth.
 * Now: explicit factory `createPassportStrategies({ passport, users, config, analytics, hasher })` owned by bootstrap,
 * single `createOAuthVerify` helper deduplicates provider logic, injectable deps enable PGlite/InMemory tests.
 *
 * Dependency: 1. In-process (strategy registration) + 2. Local-substitutable (UserRepository via PGlite) + 4. True external (OAuth profile mock).
 */
import type { PassportStatic } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { ApiError } from '../../../utils/ApiError';
import type { UserRepository, AnalyticsPort, PasswordHasher, AuthConfig } from '../ports';
import logger from '../../../logger/winston.logger';
import type { User } from '../../../db/schema';

type Deps = {
  passport: PassportStatic;
  users: UserRepository;
  config: AuthConfig;
  analytics: AnalyticsPort;
  hasher: PasswordHasher;
  env: {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_CALLBACK_URL?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GITHUB_CALLBACK_URL?: string;
  };
};

type OAuthProfile = {
  email: string;
  providerId: string;
  avatarUrl?: string | null;
  provider: 'google' | 'github';
};

/**
 * Single OAuth verify factory — hides vendor differences (Google _json.sub/picture vs GitHub node_id/avatar_url).
 * Used by both Google and GitHub strategies.
 */
async function createOAuthVerify(
  profile: any,
  provider: 'google' | 'github',
  deps: Deps,
  done: (err: any, user?: any) => void
) {
  try {
    const raw = profile._json || profile;
    const email: string | undefined = raw.email;
    if (!email) {
      logger.warn(`[${provider.toUpperCase()}] profile missing email`, { profile: raw });
      return done(new ApiError(400, 'OAuth profile missing email'));
    }

    // Normalize vendor shape
    const normalized: OAuthProfile =
      provider === 'google'
        ? { email, providerId: raw.sub as string, avatarUrl: raw.picture as string, provider }
        : { email, providerId: raw.node_id as string, avatarUrl: raw.avatar_url as string, provider };

    logger.info(`[${provider.toUpperCase()}] OAuth callback received`, {
      email: normalized.email,
      providerId: normalized.providerId,
    });

    const existing = await deps.users.findByEmail(normalized.email as string);

    if (existing) {
      logger.info(`[${provider.toUpperCase()}] Existing user found`, { id: existing.id, loginType: (existing as any).loginType });
      if ((existing as any).loginType !== provider) {
        return done(new ApiError(400, `You registered using ${(existing as any).loginType}. Please use that login method.`));
      }
      return done(null, existing);
    }

    logger.info(`[${provider.toUpperCase()}] Creating new user`);

    const created = await deps.users.create({
      email: normalized.email,
      // legacy: stores providerId as password hash; domain keeps for compat; real auth via loginType
      password: normalized.providerId,
      username: normalized.email.split('@')[0],
      isEmailVerified: true,
      role: 'user' as const,
      profilePicture: normalized.avatarUrl || null,
      loginType: provider as any,
    } as any);

    if (!created?.id) {
      logger.error(`[${provider.toUpperCase()}] User created but ID missing`, { created });
      return done(new ApiError(500, 'User created but ID missing'));
    }

    logger.info(`[${provider.toUpperCase()}] User created successfully`, { id: created.id, email: created.email });

    deps.analytics.capture({
      distinctId: created.id,
      event: 'user_registered',
      properties: { method: created.loginType as string },
    });

    done(null, created);
  } catch (err) {
    logger.error(`[${provider.toUpperCase()}] OAuth error`, { err });
    done(err as Error);
  }
}

export function createPassportStrategies(deps: Deps): PassportStatic {
  const { passport, users, hasher } = deps;

  // Serialize — id only (deep module hides user shape)
  passport.serializeUser((user: any, done) => {
    logger.info('[PASSPORT] serializeUser called', { userId: user?.id, email: user?.email, loginType: user?.loginType });
    if (!user?.id) {
      logger.error('[PASSPORT] serializeUser failed: user.id missing', { user });
      return done(new Error('serializeUser called without user.id'));
    }
    done(null, user.id);
  });

  // Deserialize — via UserRepository (testable via InMemory/PGlite)
  passport.deserializeUser(async (id: string, done) => {
    try {
      logger.info('[PASSPORT] deserializeUser called', { id });
      const user = await users.findById(id as string);
      if (!user) {
        logger.error('[PASSPORT] deserializeUser failed: user not found', { id });
        return done(new ApiError(404, 'User does not exist'));
      }
      logger.info('[PASSPORT] deserializeUser success', { id: (user as any).id, email: (user as any).email, loginType: (user as any).loginType });
      done(null, user);
    } catch (error) {
      logger.error('[PASSPORT] deserializeUser error', { error });
      done(new ApiError(500, 'Something went wrong deserializing user. Error: ' + error));
    }
  });

  // Local strategy — via injected UserRepository + PasswordHasher (no concrete db/bcrypt import)
  passport.use(
    new LocalStrategy(
      { usernameField: 'username', passwordField: 'password' },
      async (username, password, done) => {
        try {
          logger.info('[LOCAL] Authentication attempt', { username });
          const user = await users.findByEmailOrUsername(username, username);
          if (!user) {
            logger.warn('[LOCAL] User not found', { username });
            return done(new ApiError(401, 'Invalid credentials'));
          }
          if (!(user as any).isActive) {
            logger.warn('[LOCAL] Inactive user login attempt', { username });
            return done(new ApiError(401, 'Account is deactivated'));
          }
          const isPasswordValid = await hasher.compare(password, (user as any).password || '');
          if (!isPasswordValid) {
            logger.warn('[LOCAL] Invalid password', { username });
            return done(new ApiError(401, 'Invalid credentials'));
          }
          logger.info('[LOCAL] Authentication successful', { id: (user as any).id, email: (user as any).email });
          return done(null, user);
        } catch (error) {
          logger.error('[LOCAL] Authentication error', { error });
          return done(new ApiError(500, 'Authentication failed'));
        }
      }
    )
  );

  // Google — only if configured (env optional)
  if (deps.env.GOOGLE_CLIENT_ID && deps.env.GOOGLE_CLIENT_SECRET && deps.env.GOOGLE_CALLBACK_URL) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: deps.env.GOOGLE_CLIENT_ID!,
          clientSecret: deps.env.GOOGLE_CLIENT_SECRET!,
          callbackURL: deps.env.GOOGLE_CALLBACK_URL!,
        },
        async (_: any, __: any, profile: any, done: any) => createOAuthVerify(profile, 'google', deps, done)
      )
    );
  }

  // GitHub — only if configured
  if (deps.env.GITHUB_CLIENT_ID && deps.env.GITHUB_CLIENT_SECRET && deps.env.GITHUB_CALLBACK_URL) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: deps.env.GITHUB_CLIENT_ID!,
          clientSecret: deps.env.GITHUB_CLIENT_SECRET!,
          callbackURL: deps.env.GITHUB_CALLBACK_URL!,
        },
        async (_: any, __: any, profile: any, done: any) => createOAuthVerify(profile, 'github', deps, done)
      )
    );
  }

  return passport;
}

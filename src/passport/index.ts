/**
 * @deprecated — side-effect module delegates to deep factory `src/modules/auth/passport/factory`.
 * Previously 311 LoC with 70% duplication between Google/GitHub. Now single `createOAuthVerify` hidden in factory.
 * Kept for backward compat (`import './passport/index'` in app.ts); new code should use `createPassportStrategies` via bootstrap
 * with injected UserRepository (PGlite/InMemory for tests, Drizzle for prod).
 */
import passport from 'passport';
import { env } from '../config/env';
import { db } from '../config/db';
import { DrizzleUserRepository } from '../modules/auth/adapters/drizzleUserRepository';
import { posthog as posthogInstance } from '../lib/posthog';
import bcrypt from 'bcrypt';
import { createPassportStrategies } from '../modules/auth/passport/factory';

// Thin wrapper — preserves side-effect semantics for existing `import './passport/index'`
// but delegates to deep factory (single OAuth verify, injectable deps)
const users = new DrizzleUserRepository(db as any);
const analytics = {
  capture: (e: { distinctId: string; event: string; properties?: Record<string, unknown> }) =>
    (posthogInstance as any)?.capture?.({ distinctId: e.distinctId, event: e.event, properties: e.properties }),
};
const hasher = { hash: (pw: string) => bcrypt.hash(pw, 12), compare: bcrypt.compare };

createPassportStrategies({
  passport,
  users: users as any,
  config: {
    accessTokenSecret: env.ACCESS_TOKEN_SECRET,
    refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
    accessTokenExpiry: env.ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiry: env.REFRESH_TOKEN_EXPIRY,
    clientSsoRedirectUrl: env.CLIENT_SSO_REDIRECT_URL,
    forgotPasswordRedirectUrl: env.FORGOT_PASSWORD_REDIRECT_URL,
    s3Bucket: env.S3_BUCKET,
    s3Region: env.AWS_REGION,
    s3ProfilePicsPrefix: env.S3_PROFILE_PICS_PREFIX,
    resendFromEmail: env.RESEND_FROM_EMAIL,
  },
  analytics: analytics as any,
  hasher: hasher as any,
  env,
});

export default passport;

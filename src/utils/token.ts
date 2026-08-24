import crypto from 'crypto';

// Canonical token hashing — single source (used by modules/auth/domain.ts)
// Previously duplicated inline 5× across controllers; now re-exported for backward compat.
export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateTemporaryToken() {
  const unHashedToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(unHashedToken);
  const USER_TEMPORARY_TOKEN_EXPIRY = 20 * 60 * 1000; // 20 minutes
  const tokenExpiry = new Date(Date.now() + USER_TEMPORARY_TOKEN_EXPIRY);
  return { hashedToken, unHashedToken, tokenExpiry };
}

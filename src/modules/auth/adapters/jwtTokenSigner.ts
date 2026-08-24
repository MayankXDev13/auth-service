import jwt from 'jsonwebtoken';
import type { TokenSigner } from '../ports';

export class JwtTokenSigner implements TokenSigner {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
    private readonly accessExpiry: string,
    private readonly refreshExpiry: string
  ) {}

  signAccessToken(payload: { userId: string; email: string; username: string | null; role: string }): string {
    return jwt.sign(payload, this.accessSecret, { expiresIn: this.accessExpiry } as jwt.SignOptions);
  }

  signRefreshToken(payload: { userId: string }): string {
    return jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshExpiry } as jwt.SignOptions);
  }

  verifyAccessToken(token: string): { userId: string; email: string; username: string | null; role: string } {
    return jwt.verify(token, this.accessSecret) as any;
  }

  verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, this.refreshSecret) as any;
  }
}

export class FakeTokenSigner implements TokenSigner {
  // deterministic, no expiry, for fast tests
  signAccessToken(payload: { userId: string; email: string; username: string | null; role: string }): string {
    return `access:${payload.userId}`;
  }
  signRefreshToken(payload: { userId: string }): string {
    return `refresh:${payload.userId}:${Date.now()}`;
  }
  verifyAccessToken(token: string): { userId: string; email: string; username: string | null; role: string } {
    if (!token.startsWith('access:')) throw Object.assign(new Error('invalid'), { name: 'JsonWebTokenError' });
    const userId = token.slice('access:'.length);
    return { userId, email: 'test@example.com', username: 'testuser', role: 'user' };
  }
  verifyRefreshToken(token: string): { userId: string } {
    if (!token.startsWith('refresh:')) throw Object.assign(new Error('invalid'), { name: 'JsonWebTokenError' });
    const userId = token.split(':')[1];
    return { userId };
  }
}

import jwt, { JwtPayload } from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES = "7d";

export interface AccessTokenPayload extends JwtPayload {
  userId: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: string;
}

export function createAccessToken(userId: string, role: "user" | "admin") {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
}

export function createRefreshToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET!
  ) as RefreshTokenPayload;
}

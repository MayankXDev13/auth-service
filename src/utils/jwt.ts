import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES = "7d";

export function createAccessToken(userId: string) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

export function createRefreshToken(userId: string) {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as {
    userId: string;
    iat: number;
    exp: number;
  };
}

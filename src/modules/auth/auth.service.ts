import { and, eq } from "drizzle-orm";
import { db } from "../../config/db";
import { users, refreshTokens } from "../../db/schema";
import { hashPassword, verifyPassword } from "../../utils/password";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import { hashToken } from "../../utils/token";

export async function registerUser(
  email: string,
  password: string,
  name: string
) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) throw new Error("Email already exists");

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      email,
      password: passwordHash,
      name,
      provider: "local",
    })
    .returning();

  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user || !user.password) {
    throw new Error("Invalid credentials");
  }

  const validPassword = await verifyPassword(password, user.password);
  if (!validPassword) {
    throw new Error("Invalid credentials");
  }

  const accessToken = createAccessToken(user.id, "user");
  const refreshToken = createRefreshToken(user.id);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { user, accessToken, refreshToken };
}

export async function rotateRefreshToken(oldToken: string) {
  const payload = verifyRefreshToken(oldToken);

  const tokenHash = hashToken(oldToken);

  const storedToken = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.tokenHash, tokenHash),
      eq(refreshTokens.revoked, false)
    ),
  });
  if (!storedToken) {
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, payload.userId));

    throw new Error("Refresh token reuse detected");
  }

  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.id, storedToken.id));

  const newAccessToken = createAccessToken(payload.userId, "user");
  const newRefreshToken = createRefreshToken(payload.userId);

  await db.insert(refreshTokens).values({
    userId: payload.userId,
    tokenHash: hashToken(newRefreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

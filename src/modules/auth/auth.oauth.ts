import { Request, Response } from "express";
import { createAccessToken, createRefreshToken } from "../../utils/jwt";
import { hashToken } from "../../utils/token";
import { refreshTokens, users } from "../../db/schema";
import { db } from "../../config/db";
import { eq } from "drizzle-orm";

interface OAuthUser {
  id: string;
  email: string;
  name: string;
}

export async function oauthSuccess(req: Request, res: Response) {
  if (!req.user) return res.sendStatus(401);

  const { id: userId, role } = req.user;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) return res.sendStatus(401);

  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.userId, user.id));

  const refreshToken = createRefreshToken(user.id);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    })
    .redirect(`${process.env.CLIENT_URL}?loggedIn=true`);
}

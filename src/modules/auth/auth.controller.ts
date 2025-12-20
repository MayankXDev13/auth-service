import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "./auth.schmea";
import { loginUser, registerUser, rotateRefreshToken } from "./auth.service";
import { refreshTokens } from "../../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../../config/db";
import { hashToken } from "../../utils/token";

export async function register(req: Request, res: Response) {
  const body = registerSchema.parse(req.body);

  const user = await registerUser(body.email, body.password, body.name);

  res.status(201).json({
    message: "user registerd",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
}

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);

  const { user, accessToken, refreshToken } = await loginUser(
    body.email,
    body.password
  );

  res
    .status(200)
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    })
    .cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    })
    .json({
      message: "user login",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
}

export async function refreshTokenHandler(req: Request, res: Response) {
  const token = req.cookies.refreshToken;
  if (!token) return res.sendStatus(401);

  try {
    const { accessToken, refreshToken } = await rotateRefreshToken(token);

    res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      })
      .json({ accessToken });
  } catch (err) {
    res.sendStatus(401);
  }
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies.refreshToken;
  if (!token) return res.sendStatus(204);

  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.tokenHash, hashToken(token)));

  res.clearCookie("refreshToken").clearCookie("accessToken").sendStatus(204);
}

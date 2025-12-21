import { Router } from "express";
import {
  register,
  login,
  refreshTokenHandler,
  logout,
} from "./auth.controller";
import { requireAuth } from "../../middlewares/auth.middleware";
import passport from "passport";
import { oauthSuccess } from "./auth.oauth";

const router: Router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", requireAuth, logout);
router.post("/refresh", refreshTokenHandler);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  oauthSuccess
);

router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
  passport.authenticate("github", { session: false }),
  oauthSuccess
);

export default router;

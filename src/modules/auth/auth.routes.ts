import { Router } from "express";
import {
  register,
  login,
  refreshTokenHandler,
  logout,
} from "./auth.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

const router: Router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", requireAuth, logout);
router.post("/refresh", refreshTokenHandler);

export default router;

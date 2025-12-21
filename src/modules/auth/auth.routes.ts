import { Router } from "express";
import {
  register,
  login,
  refreshTokenHandler,
  logout,
} from "./auth.controller";

const router: Router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refreshTokenHandler);

export default router;

import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  verifyEmail,
  resendEmailVerification,
  refreshAccessToken,
  forgotPasswordRequest,
  resetForgottenPassword,
  changeCurrentPassword,
  assignRole,
  getCurrentUser,
} from "../../controllers/auth/user.controller";
import { verifyJWT } from "../../middlewares/auth.middleware";

const router = Router();

// Unsecured routes
router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/verify-email/:verificationToken").get(verifyEmail);
router.route("/forgot-password").post(forgotPasswordRequest);
router.route("/reset-password/:resetToken").post(resetForgottenPassword);

// Secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/avatar").post(verifyJWT);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router
  .route("/resend-email-verification")
  .post(verifyJWT, resendEmailVerification);

router.route("/assign-role/:userId").post(verifyJWT, assignRole);
router.route("/current-user").get(verifyJWT, getCurrentUser);

export default router;

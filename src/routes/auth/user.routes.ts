import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import multer from "multer";
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
  handleSocialLogin,
  updateUsername,
  uploadProfilePicture,
} from "../../controllers/auth/user.controller";
import { verifyJWT } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  assignRoleSchema,
  updateUsernameSchema,
} from "../../validators/auth.validator";
import passport from "passport";

const avatarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: "Too many profile picture upload requests, please try again later.",
});

const usernameUpdateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 updates per day
  message: "Too many username updates, please try again later.",
  keyGenerator: (req) => (req as any).user?.id || ipKeyGenerator(req.ip as string), // Rate limit per user
});

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

// Unsecured routes
router.route("/register").post(validate(registerSchema), registerUser);
router.route("/login").post(validate(loginSchema), loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/verify-email/:verificationToken").get(verifyEmail);
router.route("/forgot-password").post(validate(forgotPasswordSchema), forgotPasswordRequest);
router.route("/reset-password/:resetToken").post(validate(resetPasswordSchema), resetForgottenPassword);

// Secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/avatar").post(avatarLimiter, upload.single("avatar"), verifyJWT, uploadProfilePicture);
router.route("/username").put(verifyJWT, usernameUpdateLimiter, validate(updateUsernameSchema), updateUsername);
router.route("/change-password").post(verifyJWT, validate(changePasswordSchema), changeCurrentPassword);
router
  .route("/resend-email-verification")
  .post(verifyJWT, resendEmailVerification);

router.route("/assign-role/:userId").post(verifyJWT, validate(assignRoleSchema), assignRole);
router.route("/current-user").get(verifyJWT, getCurrentUser);

// SSO routes

router.route("/google").get(
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
  (req, res) => {
    res.send("redirecting to google...");
  }
);

router.route("/github").get(
  passport.authenticate("github", {
    scope: ["profile", "email"],
  }),
  (req, res) => {
    res.send("redirecting to github...");
  }
);

router
  .route("/google/callback")
  .get(passport.authenticate("google"), handleSocialLogin);

router
  .route("/github/callback")
  .get(passport.authenticate("github"), handleSocialLogin);

export default router;

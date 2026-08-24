/**
 * Deep route module — authenticated profile flows (current-user, username, avatar, password, logout, resend).
 * Previously part of god-router `routes/auth/user.routes.ts:116` multiplexing multer/rateLimit/auth.
 * Now: owns `avatarLimiter` + `usernameUpdateLimiter` + `multer` co-located, not shared with auth/oauth.
 */
import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import multer from 'multer';
import { logoutUser, resendEmailVerification } from '../../controllers/auth/auth.controller';
import { changeCurrentPassword } from '../../controllers/auth/password.controller';
import { getCurrentUser, updateUsername, uploadProfilePicture } from '../../controllers/auth/user.controller';
import { verifyJWT } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { changePasswordSchema, updateUsernameSchema } from '../../validators/auth.validator';

const avatarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many profile picture upload requests, please try again later.',
});

const usernameUpdateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message: 'Too many username updates, please try again later.',
  keyGenerator: req => (req as any).user?.id || ipKeyGenerator(req.ip as string),
});

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

// All routes here are authenticated — verifyJWT at router level would be option, but keep per-route for clarity
router.post('/logout', verifyJWT, logoutUser);
router.get('/current-user', verifyJWT, getCurrentUser);
router.put('/username', verifyJWT, usernameUpdateLimiter, validate(updateUsernameSchema), updateUsername);
router.post('/avatar', avatarLimiter, upload.single('avatar'), verifyJWT, uploadProfilePicture);
router.post('/change-password', verifyJWT, validate(changePasswordSchema), changeCurrentPassword);
router.post('/resend-email-verification', verifyJWT, resendEmailVerification);

export default router;

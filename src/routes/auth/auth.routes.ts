/**
 * Deep route module — public auth flows (register, login, refresh, verify, password).
 * Previously part of god-router `routes/auth/user.routes.ts:116` importing 4 controllers + 7 schemas + 5 sanitize chains.
 * Now: single responsibility — auth lifecycle, owns its validation schemas, no avatar/admin/oauth concerns.
 */
import { Router } from 'express';
import { registerUser, loginUser, verifyEmail, refreshAccessToken } from '../../controllers/auth/auth.controller';
import { forgotPasswordRequest, resetForgottenPassword } from '../../controllers/auth/password.controller';
import { validate } from '../../middlewares/validate.middleware';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../../validators/auth.validator';

const router = Router();

router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.post('/refresh-token', refreshAccessToken);
router.get('/verify-email/:verificationToken', verifyEmail);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPasswordRequest);
router.post('/reset-password/:resetToken', validate(resetPasswordSchema), resetForgottenPassword);

export default router;

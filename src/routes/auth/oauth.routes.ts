/**
 * Deep route module — OAuth SSO flows (Google, GitHub, callbacks).
 * Previously part of god-router `routes/auth/user.routes.ts:88-114` with 4 passport.authenticate handlers.
 * Now: owns passport SSO, no validation chains, isolated from auth rate-limiting.
 */
import { Router } from 'express';
import passport from 'passport';
import { handleSocialLogin } from '../../controllers/auth/auth.controller';

const router = Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }), (_req, res) => {
  res.send('redirecting to google...');
});

router.get('/github', passport.authenticate('github', { scope: ['profile', 'email'] }), (_req, res) => {
  res.send('redirecting to github...');
});

router.get('/google/callback', passport.authenticate('google'), handleSocialLogin);
router.get('/github/callback', passport.authenticate('github'), handleSocialLogin);

export default router;

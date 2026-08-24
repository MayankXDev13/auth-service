/**
 * @deprecated — God-router aggregator kept for backward compat (`import userRouter from './routes/auth/user.routes'`).
 * Previously 116 LoC multiplexing 4 controllers + 7 schemas + 5 sanitize chains + verifyJWT + multer + rateLimit + passport.
 * Now decomposed into focused modules: `auth.routes.ts` (6 endpoints), `profile.routes.ts` (6), `admin.routes.ts` (1), `oauth.routes.ts` (4).
 * This file now composes them (thin aggregator, 10 LoC). New code should import focused modules directly via `src/routes/auth/*`.
 * Also see `src/modules/auth` deep domain for HTTP-adapter-less core (`AuthDomain` + `createAuth().router`).
 */
import { Router } from 'express';
import authRoutes from './auth.routes';
import profileRoutes from './profile.routes';
import adminRoutes from './admin.routes';
import oauthRoutes from './oauth.routes';

const router = Router();

// Compose focused routers under single `/api/v1/users` mount (preserves path `auth/` vs `users` mismatch for compat)
// app.ts mounts this aggregator at `/api/v1/users`; decomposed routers could be mounted separately at same base in app wiring refactor.
router.use(authRoutes);
router.use(profileRoutes);
router.use(adminRoutes);
router.use(oauthRoutes);

export default router;

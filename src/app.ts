import express from 'express';
import type { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import morganMiddleware from './logger/morgan.logger';
import session from 'express-session';
import './passport/index'; // Passport strategies — retained for backward compat; new auth domain prefers createAuth().init()
import healthCheckRouter from './routes/healthcheck.routes';
import userRouter from './routes/auth/user.routes'; // aggregator of auth/profile/admin/oauth (see routes/auth/*.routes.ts)
import { errorHandler } from './middlewares/error.middleware';

export function makeApp(): Application {
  const app: Application = express();

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(cookieParser());

app.use(
  session({
    name: 'auth-session',
    secret: process.env.EXPRESS_SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(morganMiddleware);

  app.use('/api/v1/healthcheck', healthCheckRouter);
  // Single mount via aggregator (preserves /api/v1/users path mismatch `auth/` vs `users` for compat)
  // Decomposed alternative (explicit wiring, preferred for new code):
  // import authRoutes from './routes/auth/auth.routes'; import profileRoutes from './routes/auth/profile.routes';
  // import adminRoutes from './routes/auth/admin.routes'; import oauthRoutes from './routes/auth/oauth.routes';
  // app.use('/api/v1/users', authLimiter, authRoutes); app.use('/api/v1/users', profileRoutes);
  // app.use('/api/v1/users', adminRoutes); app.use('/api/v1/users', oauthRoutes);
  app.use('/api/v1/users', authLimiter, userRouter);

  app.use(errorHandler);

  return app;
}

const app = makeApp();
export default app;

# Configuration Guide

Complete guide for configuring the Auth Service in different environments.

## ⚙️ Environment Configuration

### Environment Variables Overview

The Auth Service uses environment variables for configuration across different environments (development, staging, production).

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` | ✅ |
| `ACCESS_TOKEN_SECRET` | JWT access token secret (32+ chars) | `super-secret-access-token-key` | ✅ |
| `REFRESH_TOKEN_SECRET` | JWT refresh token secret (32+ chars) | `super-secret-refresh-token-key` | ✅ |
| `RESEND_API_KEY` | Resend email service API key | `re_your_api_key_here` | ✅ |
| `RESEND_FROM_EMAIL` | From email for transactional emails | `noreply@yourdomain.com` | ✅ |
| `EXPRESS_SESSION_SECRET` | Express session secret (32+ chars) | `session-secret-key-here` | ✅ |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment mode | `development` | `production` |
| `PORT` | Server port | `4000` | `8080` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3000` | `https://app.domain.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - | `your-google-client-id` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - | `your-google-client-secret` |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | - | `your-github-client-id` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | - | `your-github-client-secret` |
| `CLIENT_SSO_REDIRECT_URL` | OAuth callback URL | - | `https://app.domain.com/auth/callback` |
| `FORGOT_PASSWORD_REDIRECT_URL` | Password reset redirect URL | - | `https://app.domain.com/reset-password` |

## 🗄 Database Configuration

### PostgreSQL Connection String Format

```bash
# Standard format
postgresql://username:password@host:port/database

# With SSL and connection pooling
postgresql://user:pass@host:5432/db?sslmode=require&connection_limit=20

# Neon PostgreSQL example
postgresql://neondb_owner:npg_xxx@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Database Connection Options

```typescript
// src/config/db.ts
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Idle timeout
  connectionTimeoutMillis: 10000, // Connection timeout
  ssl: {
    rejectUnauthorized: false // For cloud databases
  },
  application_name: "auth-service"
});
```

### Database Schema Configuration

```typescript
// src/db/schema/user.ts
import { pgTable, text, timestamp, boolean, uuid, enum as pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const loginTypeEnum = pgEnum('login_type', ['email_password', 'google', 'github']);
export const roleEnum = pgEnum('role', ['admin', 'user']);

// Users table
export const User = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password"),
  fullName: text("full_name").notNull(),
  loginType: loginTypeEnum("login_type").default("email_password"),
  providerId: text("provider_id"),
  profilePicture: text("profile_picture"),
  isEmailVerified: boolean("is_email_verified").default(false),
  isActive: boolean("is_active").default(true),
  role: roleEnum("role").default("user"),
  refreshToken: text("refresh_token"),
  forgotPasswordToken: text("forgot_password_token"),
  forgotPasswordTokenExpiresAt: timestamp("forgot_password_token_expires_at"),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  // Indexes for performance
  emailIdx: index("email_idx").on(table.email),
  usernameIdx: index("username_idx").on(table.username),
  activeUserIdx: index("active_user_idx").on(table.isActive).where(eq(table.isActive, true))
}));
```

## 🔐 Security Configuration

### JWT Token Configuration

```typescript
// src/utils/token.ts
import jwt from 'jsonwebtoken';

// Access token configuration
const accessTokenConfig = {
  secret: process.env.ACCESS_TOKEN_SECRET!,
  expiresIn: '15m',
  algorithm: 'HS256' as const
};

// Refresh token configuration
const refreshTokenConfig = {
  secret: process.env.REFRESH_TOKEN_SECRET!,
  expiresIn: '7d',
  algorithm: 'HS256' as const
};

// Generate tokens
export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    accessTokenConfig.secret,
    { expiresIn: accessTokenConfig.expiresIn, algorithm: accessTokenConfig.algorithm }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    refreshTokenConfig.secret,
    { expiresIn: refreshTokenConfig.expiresIn, algorithm: refreshTokenConfig.algorithm }
  );

  return { accessToken, refreshToken };
};
```

### Password Security Configuration

```typescript
// src/utils/password.ts
import bcrypt from 'bcrypt';

// Password hashing configuration
const saltRounds = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};
```

### Security Headers Configuration

```typescript
// src/app.ts
import helmet from 'helmet';

// Production security headers
const securityConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

app.use(helmet(securityConfig));
```

### CORS Configuration

```typescript
// src/app.ts
import cors from 'cors';

const corsConfig = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};

app.use(cors(corsConfig));
```

### Rate Limiting Configuration

```typescript
// src/app.ts
import rateLimit from 'express-rate-limit';

// Auth endpoints rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// Apply to auth routes
app.use("/api/v1/users", authLimiter);
```

## 📧 Email Configuration

### Resend Email Service

```typescript
// src/utils/mail.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const emailConfig = {
  from: process.env.RESEND_FROM_EMAIL!,
  replyTo: process.env.RESEND_REPLY_TO_EMAIL || process.env.RESEND_FROM_EMAIL
};

// Send email function
export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      to: [to],
      subject,
      html
    });

    if (error) {
      throw new Error(`Email send failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
};
```

### Email Templates Configuration

```typescript
// src/templates/email.ts
export const emailTemplates = {
  verification: (token: string, userName: string) => ({
    subject: 'Verify Your Email Address',
    html: `
      <h2>Welcome ${userName}!</h2>
      <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
      <a href="${process.env.CLIENT_URL}/verify-email?token=${token}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `
  }),

  passwordReset: (token: string, userName: string) => ({
    subject: 'Reset Your Password',
    html: `
      <h2>Hello ${userName}!</h2>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <a href="${process.env.CLIENT_URL}/reset-password?token=${token}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  })
};
```

## 🌐 OAuth Configuration

### Google OAuth Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing one
   - Enable Google+ API

2. **Create OAuth Credentials**
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Select "Web application"
   - Add authorized redirect URI: `https://yourdomain.com/api/v1/users/auth/google/callback`

3. **Environment Variables**
```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### GitHub OAuth Setup

1. **Create GitHub OAuth App**
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click "New OAuth App"
   - Fill in application details
   - Set callback URL: `https://yourdomain.com/api/v1/users/auth/github/callback`

2. **Environment Variables**
```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### Passport.js Configuration

```typescript
// src/passport/google.strategy.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: "/api/v1/users/auth/google/callback",
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Handle OAuth user creation/login
    let user = await findUserByProviderId('google', profile.id);
    
    if (!user) {
      user = await createOAuthUser({
        providerId: profile.id,
        email: profile.emails[0].value,
        username: profile.displayName,
        fullName: profile.displayName,
        loginType: 'google',
        profilePicture: profile.photos[0].value
      });
    }
    
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));
```

## 📊 Logging Configuration

### Winston Logger Configuration

```typescript
// src/logger/winston.logger.ts
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'auth-service' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Combined logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
```

### Morgan HTTP Logger Configuration

```typescript
// src/logger/morgan.logger.ts
import morgan from 'morgan';
import winston from './winston.logger';

const stream = {
  write: (message: string) => {
    winston.info(message.trim());
  }
};

const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream }
);

export default morganMiddleware;
```

## 🔍 Environment-Specific Configurations

### Development Configuration

```env
# .env.development
NODE_ENV=development
PORT=4000
LOG_LEVEL=debug

# Database (local)
DATABASE_URL=postgresql://postgres:password@localhost:5432/auth_service_dev

# JWT (development secrets)
ACCESS_TOKEN_SECRET=dev-access-token-secret-key
REFRESH_TOKEN_SECRET=dev-refresh-token-secret-key

# Email (development - can use test service)
RESEND_API_KEY=re_test_api_key
RESEND_FROM_EMAIL=dev@localhost

# CORS (development origins)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Session
EXPRESS_SESSION_SECRET=dev-session-secret-key

# OAuth (development - can use test apps)
GOOGLE_CLIENT_ID=dev-google-client-id
GOOGLE_CLIENT_SECRET=dev-google-client-secret
```

### Staging Configuration

```env
# .env.staging
NODE_ENV=staging
PORT=4000
LOG_LEVEL=info

# Database (staging)
DATABASE_URL=postgresql://user:pass@staging-db.host:5432/auth_service_staging

# JWT (staging secrets)
ACCESS_TOKEN_SECRET=staging-access-token-secret-key-32-chars
REFRESH_TOKEN_SECRET=staging-refresh-token-secret-key-32-chars

# Email (staging)
RESEND_API_KEY=re_staging_api_key
RESEND_FROM_EMAIL=noreply@staging.yourdomain.com

# CORS (staging domains)
ALLOWED_ORIGINS=https://staging.yourdomain.com,https://app-staging.yourdomain.com

# Session
EXPRESS_SESSION_SECRET=staging-session-secret-key-32-chars

# OAuth (staging)
GOOGLE_CLIENT_ID=staging-google-client-id
GOOGLE_CLIENT_SECRET=staging-google-client-secret
```

### Production Configuration

```env
# .env.production
NODE_ENV=production
PORT=4000
LOG_LEVEL=warn

# Database (production with connection pooling)
DATABASE_URL=postgresql://user:pass@prod-db.host:5432/auth_service_prod?connection_limit=20&pool_timeout=10

# JWT (production secrets - use strong randomly generated keys)
ACCESS_TOKEN_SECRET=prod-super-strong-access-token-secret-64-chars-minimum
REFRESH_TOKEN_SECRET=prod-super-strong-refresh-token-secret-64-chars-minimum

# Email (production)
RESEND_API_KEY=re_production_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# CORS (production domains only)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Session
EXPRESS_SESSION_SECRET=prod-super-strong-session-secret-64-chars-minimum

# OAuth (production)
GOOGLE_CLIENT_ID=prod-google-client-id
GOOGLE_CLIENT_SECRET=prod-google-client-secret

# Optional: Monitoring
POSTHOG_API_KEY=prod-posthog-api-key
POSTHOG_HOST=https://api.posthog.com

# Optional: Redis for caching
REDIS_URL=redis://user:pass@redis-host:6379
```

## 🧪 Testing Configuration

### Test Environment Variables

```env
# .env.test
NODE_ENV=test
PORT=4001
LOG_LEVEL=error

# Database (test)
DATABASE_URL=postgresql://postgres:password@localhost:5432/auth_service_test

# JWT (test secrets)
ACCESS_TOKEN_SECRET=test-access-token-secret-key
REFRESH_TOKEN_SECRET=test-refresh-token-secret-key

# Email (test - mock or use test service)
RESEND_API_KEY=re_test_api_key
RESEND_FROM_EMAIL=test@localhost

# CORS (test)
ALLOWED_ORIGINS=http://localhost:3000

# Session
EXPRESS_SESSION_SECRET=test-session-secret-key
```

### Jest Configuration

```json
// jest.config.json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": ["<rootDir>/src", "<rootDir>/tests"],
  "testMatch": ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/server.ts"
  ],
  "coverageDirectory": "coverage",
  "coverageReporters": ["text", "lcov", "html"],
  "setupFilesAfterEnv": ["<rootDir>/tests/setup.ts"]
}
```

## 🔧 Configuration Validation

### Environment Variable Validation

```typescript
// src/config/env.ts
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  ALLOWED_ORIGINS: z.string().optional(),
  
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  
  // JWT
  ACCESS_TOKEN_SECRET: z.string().min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters"),
  REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters"),
  
  // Email
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM_EMAIL: z.string().email("RESEND_FROM_EMAIL must be a valid email"),
  
  // Session
  EXPRESS_SESSION_SECRET: z.string().min(32, "EXPRESS_SESSION_SECRET must be at least 32 characters"),
  
  // OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  
  // Redirect URLs
  CLIENT_SSO_REDIRECT_URL: z.string().url().optional(),
  FORGOT_PASSWORD_REDIRECT_URL: z.string().url().optional()
});

// Validate environment variables
export const env = envSchema.parse(process.env);

// Export validated config
export default env;
```

### Configuration Health Check

```typescript
// src/utils/config-health.ts
export const checkConfiguration = () => {
  const issues: string[] = [];
  
  // Check required variables
  const requiredVars = [
    'DATABASE_URL',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'EXPRESS_SESSION_SECRET'
  ];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      issues.push(`Missing required environment variable: ${varName}`);
    }
  });
  
  // Check secret lengths
  const secretVars = ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET', 'EXPRESS_SESSION_SECRET'];
  secretVars.forEach(varName => {
    const secret = process.env[varName];
    if (secret && secret.length < 32) {
      issues.push(`${varName} must be at least 32 characters long`);
    }
  });
  
  // Check email format
  const email = process.env.RESEND_FROM_EMAIL;
  if (email && !email.includes('@')) {
    issues.push('RESEND_FROM_EMAIL must be a valid email address');
  }
  
  return {
    healthy: issues.length === 0,
    issues
  };
};
```

---

**🎯 Your Auth Service is now properly configured!**
# Auth Service

A production-ready Node.js/TypeScript authentication service built with Express.js, featuring JWT-based authentication, OAuth support, and enterprise-grade security.

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd auth-service
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your database and service credentials

# Setup database
pnpm db:migrate

# Start service
pnpm dev
```

## 📋 Features

- 🔐 **JWT Authentication** - Access & refresh tokens
- 🌐 **OAuth Support** - Google & GitHub login
- 📧 **Email Verification** - Account activation
- 🔑 **Password Reset** - Secure recovery flow
- 🛡️ **Security Features** - Rate limiting, CORS, Helmet
- ✅ **Input Validation** - Zod schema validation
- 🏥 **Health Monitoring** - Database & server health checks
- 📊 **Type Safety** - Full TypeScript support

## 🛠 Tech Stack

- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** JWT, bcrypt, Passport.js
- **Email:** Resend service
- **Security:** Helmet, CORS, express-rate-limit
- **Validation:** Zod schemas

## 📖 Documentation

For complete API documentation, setup instructions, and deployment guides:

**👉 [View Full API Documentation](./API_DOCUMENTATION.md)**

## 🌐 API Endpoints

### Health Checks
- `GET /api/v1/healthcheck` - Full system health
- `GET /api/v1/healthcheck/simple` - Server health only

### Authentication
- `POST /api/v1/users/register` - User registration
- `POST /api/v1/users/login` - User login
- `POST /api/v1/users/logout` - User logout
- `POST /api/v1/users/refresh-token` - Refresh access token

### Email & Password
- `POST /api/v1/users/verify-email` - Verify email address
- `POST /api/v1/users/forgot-password` - Request password reset
- `POST /api/v1/users/reset-password` - Reset password

### OAuth
- `GET /api/v1/users/auth/google` - Google OAuth
- `GET /api/v1/users/auth/github` - GitHub OAuth

## ⚙️ Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# JWT Secrets (32+ chars each)
ACCESS_TOKEN_SECRET=your-super-secret-access-token
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token

# Email Service (Resend)
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Session
EXPRESS_SESSION_SECRET=your-session-secret-32-chars

# OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Redirect URLs
CLIENT_SSO_REDIRECT_URL=http://localhost:3000/auth/callback
FORGOT_PASSWORD_REDIRECT_URL=http://localhost:3000/reset-password
```

## 🏥 Health Check Status

```bash
curl http://localhost:4000/api/v1/healthcheck
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Health Check Passed",
  "data": {
    "status": "OK",
    "timestamp": "2025-12-26T07:58:30.173Z",
    "uptime": 13.367850478,
    "server": "running",
    "database": "connected",
    "environment": "development"
  }
}
```

## 🛡️ Security Features

- **Rate Limiting:** 5 requests/15min on auth endpoints
- **Security Headers:** Helmet.js with CSP, HSTS, XSS protection
- **Input Validation:** Comprehensive Zod schema validation
- **Password Security:** bcrypt with 12 salt rounds
- **CORS:** Configurable cross-origin resource sharing
- **JWT Security:** Separate access/refresh tokens with rotation

## 📊 Database Schema

### Users Table
```sql
- id: UUID (Primary Key)
- email: VARCHAR(256) (Unique)
- username: VARCHAR(256) (Unique)
- password: VARCHAR(256) (Hashed)
- fullName: VARCHAR(256)
- login_type: ENUM('email_password', 'google', 'github')
- provider_id: VARCHAR(256)
- profile_picture: VARCHAR(512)
- is_email_verified: BOOLEAN
- is_active: BOOLEAN
- role: ENUM('admin', 'user')
- refresh_token: VARCHAR(512)
- forgot_password_token: VARCHAR(512)
- forgot_password_token_expires_at: TIMESTAMP
- email_verification_token: VARCHAR(512)
- email_verification_expiry: TIMESTAMP
- last_login_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## 🚀 Production Deployment

### Docker Setup
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install --prod
COPY . .
RUN pnpm build
EXPOSE 4000
CMD ["pnpm", "start"]
```

### Environment Configuration
```bash
NODE_ENV=production
PORT=4000
# Configure production database and services
```

## 🛠 Development

```bash
# Available scripts
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm db:migrate       # Run database migrations
pnpm db:generate      # Generate new migration
pnpm db:studio        # Open Drizzle Studio
pnpm lint             # Run ESLint
pnpm typecheck        # TypeScript type checking
```

## 📝 API Examples

### Register User
```bash
curl -X POST http://localhost:4000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

### Login User
```bash
curl -X POST http://localhost:4000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "SecurePass123!"
  }'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For detailed documentation, API reference, and troubleshooting:

**📖 [Complete API Documentation](./API_DOCUMENTATION.md)**

---

**Version:** 1.0.0  
**Status:** Production Ready ✅  
**Last Updated:** 2025-12-26
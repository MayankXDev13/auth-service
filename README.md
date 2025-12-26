# Auth Service

A comprehensive Node.js/TypeScript authentication service built with Express.js, featuring JWT-based authentication, OAuth support, and robust security measures.

## Features

- 🔐 **Email/Password Authentication** - Secure user registration and login
- 📧 **Email Verification** - Account activation via email
- 🔑 **JWT Token System** - Access and refresh token management
- 🔄 **Password Reset** - Secure password recovery flow
- 🌐 **OAuth Support** - Google and GitHub authentication via Passport.js
- 👥 **Role-Based Access Control** - Admin and user roles
- 📊 **User Analytics** - PostHog integration for user behavior tracking
- 🛡️ **Security Features** - Helmet, CORS, rate limiting, bcrypt password hashing

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** JWT, bcrypt, Passport.js
- **Email:** Nodemailer with Mailgen templates
- **Analytics:** PostHog
- **Security:** Helmet, CORS, express-rate-limit

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Environment variables configured

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd auth-service

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/auth_db

# JWT Secrets
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# OAuth Providers
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Application
NODE_ENV=development
CLIENT_SSO_REDIRECT_URL=http://localhost:3000/auth/callback
FORGOT_PASSWORD_REDIRECT_URL=http://localhost:3000/reset-password

# Analytics
POSTHOG_API_KEY=your_posthog_api_key
POSTHOG_HOST=https://api.posthog.com

# Session
EXPRESS_SESSION_SECRET=your_session_secret
```

## Database Setup

```bash
# Generate database migrations
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Open Drizzle Studio (optional)
pnpm db:studio
```

## Usage

### Development

```bash
# Start development server with hot reload
pnpm dev
```

### Production

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/users/register` | User registration |
| `POST` | `/api/v1/users/login` | User login |
| `POST` | `/api/v1/users/logout` | User logout |
| `GET` | `/api/v1/users/current-user` | Get current user |
| `POST` | `/api/v1/users/refresh-token` | Refresh access token |

### Email Verification

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/users/verify-email/:token` | Verify email address |
| `POST` | `/api/v1/users/resend-email-verification` | Resend verification email |

### Password Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/users/forgot-password` | Request password reset |
| `POST` | `/api/v1/users/reset-password/:token` | Reset forgotten password |
| `POST` | `/api/v1/users/change-password` | Change current password |

### OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/users/auth/google` | Google OAuth login |
| `GET` | `/api/v1/users/auth/github` | GitHub OAuth login |
| `GET` | `/api/v1/users/auth/google/callback` | Google OAuth callback |
| `GET` | `/api/v1/users/auth/github/callback` | GitHub OAuth callback |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/users/assign-role/:userId` | Assign user role |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/healthcheck` | Service health status |

## Database Schema

### Users Table

```sql
- id: UUID (Primary Key)
- email: VARCHAR(256) (Unique)
- username: VARCHAR(256)
- password: VARCHAR(256) (Hashed)
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

## Security Features

- **Password Hashing:** Uses bcrypt with salt rounds (12)
- **JWT Security:** Separate access and refresh tokens with configurable expiry
- **Token Rotation:** Refresh token invalidation on use
- **Email Verification:** Prevents fake account registration
- **Rate Limiting:** Protection against brute force attacks
- **CORS Configuration:** Cross-origin resource sharing setup
- **Helmet:** Security headers configuration
- **Session Management:** Secure session handling with httpOnly cookies

## User Analytics

The service tracks user behavior using PostHog:

- `user_registered` - New user registration
- `user_logged_in` - User login events
- `user_logged_out` - User logout events
- `email_verified` - Email verification completion
- `password_reset_requested` - Password reset requests
- `password_reset_completed` - Successful password resets
- `access_token_refreshed` - Token refresh events
- `user_role_changed` - Role assignment events

## Error Handling

The service uses a centralized error handling system with:

- Standardized API error responses
- Proper HTTP status codes
- Detailed error logging with Winston
- User-friendly error messages

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the package.json file for details.

## Support

For support and questions, please open an issue in the repository.
# Auth Service API Documentation

A production-ready Node.js/TypeScript authentication service built with Express.js, PostgreSQL, and Drizzle ORM.

## 🚀 Features

- **JWT Authentication** with refresh tokens
- **OAuth Support** (Google & GitHub)
- **Email Verification** with Resend
- **Password Reset** functionality
- **Rate Limiting** for security
- **Input Validation** with Zod schemas
- **Security Headers** via Helmet
- **Health Monitoring** endpoints
- **TypeScript** for type safety
- **PostgreSQL** with Drizzle ORM

## 📋 Table of Contents

- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Security Features](#security-features)
- [Health Checks](#health-checkes)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Development](#development)
- [Deployment](#deployment)

## 🛠 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL database
- pnpm package manager

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd auth-service
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Setup database**
```bash
# Run database migrations
pnpm db:migrate

# (Optional) Seed database with test data
pnpm db:seed
```

5. **Start the service**
```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

## ⚙️ Environment Variables

Create a `.env` file with the following variables:

```env
# Application
NODE_ENV=development
PORT=4000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Database
DATABASE_URL=postgresql://username:password@host:port/database

# JWT Tokens
ACCESS_TOKEN_SECRET=your-super-secret-access-token-min-32-chars
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-min-32-chars

# Email Service (Resend)
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Session
EXPRESS_SESSION_SECRET=your-session-secret-min-32-chars

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Redirect URLs
CLIENT_SSO_REDIRECT_URL=http://localhost:3000/auth/callback
FORGOT_PASSWORD_REDIRECT_URL=http://localhost:3000/reset-password
```

## 🗄 Database Setup

### PostgreSQL with Neon (Recommended)

1. **Create Neon account** at [neon.tech](https://neon.tech)
2. **Create database** and get connection string
3. **Add DATABASE_URL** to your `.env` file

### Local PostgreSQL

```bash
# Create database
createdb auth_service

# Run migrations
pnpm db:migrate
```

### Database Schema

The service uses the following main tables:

- **users** - User accounts and profiles
- **user_sessions** - Active user sessions
- **email_verifications** - Email verification tokens

## 🌐 API Endpoints

### Base URL
```
http://localhost:4000/api/v1
```

### Health Check Endpoints

#### Get Full Health Check
```http
GET /healthcheck
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

#### Get Simple Health Check
```http
GET /healthcheck/simple
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Server Health Check Passed",
  "data": {
    "status": "OK",
    "timestamp": "2025-12-26T07:58:30.419Z",
    "uptime": 13.613790279,
    "server": "running",
    "environment": "development"
  }
}
```

### Authentication Endpoints

#### Register User
```http
POST /users/register
```

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe"
}
```

**Response:**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Users registered successfully and verification email has been sent on your email.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "username": "johndoe",
      "fullName": "John Doe",
      "isEmailVerified": false,
      "isActive": true,
      "role": "user",
      "createdAt": "2025-12-26T07:58:31.868Z"
    }
  }
}
```

#### Login User
```http
POST /users/login
```

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User logged in successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "username": "johndoe",
      "fullName": "John Doe",
      "isEmailVerified": true,
      "isActive": true,
      "role": "user"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

#### Refresh Access Token
```http
POST /users/refresh-token
```

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Access token refreshed successfully",
  "data": {
    "accessToken": "new_jwt_access_token"
  }
}
```

#### Logout User
```http
POST /users/logout
```

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User logged out successfully",
  "data": {}
}
```

#### Forgot Password
```http
POST /users/forgot-password
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Password reset email sent successfully",
  "data": {}
}
```

#### Reset Password
```http
POST /users/reset-password
```

**Request Body:**
```json
{
  "resetToken": "reset_token_from_email",
  "newPassword": "NewSecurePass123!"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Password reset successfully",
  "data": {}
}
```

#### Verify Email
```http
POST /users/verify-email
```

**Request Body:**
```json
{
  "verificationToken": "token_from_email"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Email verified successfully",
  "data": {}
}
```

### OAuth Endpoints

#### Google OAuth
```http
GET /users/auth/google
```

#### Google OAuth Callback
```http
GET /users/auth/google/callback
```

#### GitHub OAuth
```http
GET /users/auth/github
```

#### GitHub OAuth Callback
```http
GET /users/auth/github/callback
```

## 🔐 Authentication

### JWT Token Structure

**Access Token:**
- **Expiration:** 15 minutes
- **Usage:** API requests
- **Header:** `Authorization: Bearer <access_token>`

**Refresh Token:**
- **Expiration:** 7 days
- **Usage:** Get new access tokens
- **Storage:** HTTP-only cookies

### Token Refresh Flow

1. **Client** sends refresh token to `/users/refresh-token`
2. **Server** validates refresh token
3. **Server** generates new access token
4. **Client** uses new access token for API calls

### Protected Routes

Add the `Authorization` header to access protected routes:

```http
Authorization: Bearer <access_token>
```

## 🛡 Security Features

### Rate Limiting

- **Auth Endpoints:** 5 requests per 15 minutes
- **Other Endpoints:** No rate limiting
- **Headers:** `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

### Security Headers

Implemented via Helmet.js:

- **Content Security Policy:** Strict CSP configuration
- **HSTS:** HTTP Strict Transport Security
- **X-Frame-Options:** `SAMEORIGIN`
- **X-Content-Type-Options:** `nosniff`
- **Referrer Policy:** `no-referrer`

### Input Validation

All inputs are validated using Zod schemas:

- **Email:** Valid email format
- **Password:** 8+ chars, uppercase, lowercase, number, special character
- **Username:** 3+ characters, alphanumeric
- **Full Name:** Required, non-empty

### Password Security

- **Hashing:** bcrypt with 12 salt rounds
- **Storage:** Only hashed passwords stored
- **Validation:** Strong password requirements

## 🏥 Health Checks

### Monitoring Endpoints

| Endpoint | Purpose | Database Dependency |
|----------|---------|---------------------|
| `/healthcheck` | Full system health | ✅ Required |
| `/healthcheck/simple` | Server health only | ❌ Not required |

### Health Check Response

**Healthy Response (200):**
```json
{
  "status": "OK",
  "timestamp": "2025-12-26T07:58:30.173Z",
  "uptime": 13.367850478,
  "server": "running",
  "database": "connected",
  "environment": "development"
}
```

**Degraded Response (503):**
```json
{
  "status": "DEGRADED",
  "timestamp": "2025-12-26T07:58:30.173Z",
  "uptime": 13.367850478,
  "server": "running",
  "database": "disconnected",
  "environment": "development"
}
```

## ⚠ Error Handling

### Standard Error Response

```json
{
  "statusCode": 400,
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Common HTTP Status Codes

| Status | Description | Example |
|--------|-------------|---------|
| 200 | Success | Login successful |
| 201 | Created | User registered |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Invalid token |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Endpoint not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |
| 503 | Service Unavailable | Database disconnected |

### Validation Errors

```json
{
  "statusCode": 400,
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters long"
    }
  ]
}
```

## 🚦 Rate Limiting

### Configuration

- **Window:** 15 minutes
- **Limit:** 5 requests per IP
- **Endpoints:** All authentication endpoints
- **Headers:** Rate limit information included

### Rate Limit Headers

```http
RateLimit-Limit: 5
RateLimit-Remaining: 3
RateLimit-Reset: 900
RateLimit-Policy: 5;w=900
```

### Rate Limit Exceeded Response

```json
{
  "statusCode": 429,
  "success": false,
  "message": "Too many authentication attempts, please try again later."
}
```

## 🛠 Development

### Available Scripts

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run database migrations
pnpm db:migrate

# Generate new migration
pnpm db:generate

# Push schema changes
pnpm db:push

# Drop database
pnpm db:drop

# Run tests
pnpm test

# Run linting
pnpm lint

# Type checking
pnpm typecheck
```

### Database Commands

```bash
# Create new migration
pnpm drizzle-kit generate

# Run migrations
pnpm drizzle-kit migrate

# View database
pnpm drizzle-kit studio
```

### Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── db/              # Database schema
├── lib/             # External libraries
├── logger/          # Logging configuration
├── middlewares/     # Express middlewares
├── passport/        # OAuth strategies
├── routes/          # API routes
├── types/           # TypeScript types
├── utils/           # Utility functions
├── validators/      # Input validation schemas
├── app.ts           # Express app configuration
└── server.ts        # Server entry point
```

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
```bash
NODE_ENV=production
PORT=4000
```

2. **Database Setup**
```bash
# Run migrations
pnpm db:migrate
```

3. **Build Application**
```bash
pnpm build
```

4. **Start Server**
```bash
pnpm start
```

### Docker Deployment

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

### Environment-Specific Configurations

**Development:**
- Detailed error messages
- Development database
- Relaxed security headers
- Debug logging

**Production:**
- Generic error messages
- Production database
- Strict security headers
- Error logging only

## 📝 API Examples

### Registration Example

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

### Login Example

```bash
curl -X POST http://localhost:4000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "SecurePass123!"
  }'
```

### Protected Route Example

```bash
curl -X GET http://localhost:4000/api/v1/users/profile \
  -H "Authorization: Bearer <access_token>"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation
- Review the API examples

## 🔗 Related Services

- **Frontend Application:** Your client application
- **Email Service:** Resend for transactional emails
- **Database:** PostgreSQL (Neon recommended)
- **OAuth Providers:** Google & GitHub

---

**Version:** 1.0.0  
**Last Updated:** 2025-12-26  
**Author:** Auth Service Team
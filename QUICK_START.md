# Auth Service - Quick Start Guide

Get your authentication service running in minutes with this quick start guide.

## 🚀 Prerequisites

- Node.js 18+ 
- PostgreSQL database (Neon recommended)
- pnpm package manager

## ⚡ 5-Minute Setup

### 1. Clone & Install
```bash
git clone <repository-url>
cd auth-service
pnpm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

Edit `.env` with minimum required variables:
```env
# Database (get from Neon or local PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/db

# JWT Secrets (generate random 32+ character strings)
ACCESS_TOKEN_SECRET=your-super-secret-access-token-32-chars
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-32-chars

# Email (get from Resend.com)
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Session
EXPRESS_SESSION_SECRET=your-session-secret-32-chars
```

### 3. Database Setup
```bash
pnpm db:migrate
```

### 4. Start Service
```bash
pnpm dev
```

Service will be running at: `http://localhost:4000`

## 🧪 Quick Test

```bash
# Test health check
curl http://localhost:4000/api/v1/healthcheck

# Test user registration
curl -X POST http://localhost:4000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com", 
    "password": "TestPass123!",
    "fullName": "Test User"
  }'
```

## 📚 Next Steps

- **📖 Full Documentation**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **🛠 Development Guide**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **🚀 Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **🔧 Configuration**: [CONFIGURATION.md](./CONFIGURATION.md)

## 🆘 Need Help?

- Check the [troubleshooting section](./TROUBLESHOOTING.md)
- Review [common issues](./FAQ.md)
- Open an issue in the repository

---

**Ready in 5 minutes! 🎉**
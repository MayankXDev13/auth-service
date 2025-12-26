# Deployment Guide

Complete guide for deploying the Auth Service to production environments.

## 🚀 Production Deployment Options

### 1. Docker Deployment (Recommended)

#### Dockerfile
```dockerfile
# Multi-stage build for optimization
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/healthcheck/simple || exit 1

# Start application
CMD ["node", "dist/server.js"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  auth-service:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - ACCESS_TOKEN_SECRET=${ACCESS_TOKEN_SECRET}
      - REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL}
      - EXPRESS_SESSION_SECRET=${EXPRESS_SESSION_SECRET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/v1/healthcheck/simple"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: PostgreSQL for local development
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=auth_service
      - POSTGRES_USER=auth_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Deployment Commands
```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f auth-service

# Scale the service
docker-compose up -d --scale auth-service=3
```

### 2. Cloud Platform Deployment

#### Heroku
```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create your-auth-service

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set DATABASE_URL=your_database_url
heroku config:set ACCESS_TOKEN_SECRET=your_access_token_secret
heroku config:set REFRESH_TOKEN_SECRET=your_refresh_token_secret
heroku config:set RESEND_API_KEY=your_resend_api_key
heroku config:set RESEND_FROM_EMAIL=noreply@yourdomain.com
heroku config:set EXPRESS_SESSION_SECRET=your_session_secret

# Deploy
git push heroku main

# Open app
heroku open
```

#### Vercel
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

#### AWS ECS
```json
// task-definition.json
{
  "family": "auth-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "auth-service",
      "image": "your-account.dkr.ecr.region.amazonaws.com/auth-service:latest",
      "portMappings": [
        {
          "containerPort": 4000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:auth-service/db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/auth-service",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:4000/api/v1/healthcheck/simple || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### 3. Traditional Server Deployment

#### System Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Amazon Linux 2
- **CPU**: 1+ cores
- **Memory**: 2GB+ RAM
- **Storage**: 20GB+ SSD
- **Node.js**: 18.x LTS

#### Deployment Script
```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Starting Auth Service Deployment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Create application user
sudo useradd -m -s /bin/bash authservice
sudo usermod -aG sudo authservice

# Create application directory
sudo mkdir -p /opt/auth-service
sudo chown authservice:authservice /opt/auth-service

# Switch to application user
sudo -u authservice bash << 'EOF'

# Navigate to app directory
cd /opt/auth-service

# Clone repository (or copy files)
git clone <repository-url> .

# Install dependencies
pnpm install --prod

# Build application
pnpm build

# Run database migrations
pnpm db:migrate

# Create systemd service
sudo tee /etc/systemd/system/auth-service.service > /dev/null << EOL
[Unit]
Description=Auth Service
After=network.target

[Service]
Type=simple
User=authservice
WorkingDirectory=/opt/auth-service
Environment=NODE_ENV=production
EnvironmentFile=/opt/auth-service/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable auth-service
sudo systemctl start auth-service

echo "✅ Auth Service deployed successfully!"
echo "🌐 Service is running at: http://localhost:4000"
echo "📊 Health check: http://localhost:4000/api/v1/healthcheck"

EOF
```

## 🔧 Production Configuration

### Environment Variables
```env
# Production Environment
NODE_ENV=production
PORT=4000

# Database (Use connection pooling)
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10

# JWT Secrets (Use strong, randomly generated secrets)
ACCESS_TOKEN_SECRET=your-super-strong-access-token-secret-64-chars-minimum
REFRESH_TOKEN_SECRET=your-super-strong-refresh-token-secret-64-chars-minimum

# Email Service
RESEND_API_KEY=re_production_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Session Security
EXPRESS_SESSION_SECRET=your-super-strong-session-secret-64-chars-minimum

# CORS (Configure your frontend domains)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# OAuth (if using)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Redirect URLs (HTTPS in production)
CLIENT_SSO_REDIRECT_URL=https://yourdomain.com/auth/callback
FORGOT_PASSWORD_REDIRECT_URL=https://yourdomain.com/reset-password

# Optional: Monitoring
POSTHOG_API_KEY=your_posthog_api_key
POSTHOG_HOST=https://api.posthog.com

# Optional: Redis for caching
REDIS_URL=redis://user:pass@host:6379
```

### Nginx Configuration
```nginx
# /etc/nginx/sites-available/auth-service
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
    
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Apply rate limiting to auth endpoints
        location /api/v1/users/ {
            limit_req zone=auth burst=10 nodelay;
        }
    }
    
    # Health check endpoint (no rate limiting)
    location /api/v1/healthcheck {
        proxy_pass http://localhost:4000;
        access_log off;
    }
}
```

## 📊 Monitoring & Logging

### Application Monitoring
```typescript
// src/monitoring/metrics.ts
import { createPrometheusMetrics } from 'prom-client';

const metrics = {
  httpRequestsTotal: new createPrometheusMetrics.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),
  
  httpRequestDuration: new createPrometheusMetrics.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5]
  }),
  
  activeConnections: new createPrometheusMetrics.Gauge({
    name: 'active_connections',
    help: 'Number of active database connections'
  }),
  
  userRegistrations: new createPrometheusMetrics.Counter({
    name: 'user_registrations_total',
    help: 'Total number of user registrations'
  })
};

export { metrics };
```

### Health Check Enhancements
```typescript
// src/controllers/healthcheck.controller.ts
const detailedHealthCheck = asyncHandler(async (req: Request, res: Response) => {
  const healthData = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    server: "running",
    database: "connected",
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    connections: {
      active: pool.totalCount - pool.idleCount,
      idle: pool.idleCount,
      total: pool.totalCount
    }
  };

  // Add metrics endpoint
  if (req.query.metrics === 'true') {
    healthData.metrics = await getMetrics();
  }

  return res.status(200).json(new ApiResponse(200, healthData, "Health Check Passed"));
});
```

### Log Management
```typescript
// src/logger/production.logger.ts
import winston from 'winston';
import 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-service' },
  transports: [
    // Error logs
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    
    // Combined logs
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    
    // Console logging for container environments
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export default logger;
```

## 🔒 Security Hardening

### SSL/TLS Configuration
```bash
# Generate SSL certificate with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Firewall Configuration
```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Security Headers
```typescript
// Enhanced Helmet configuration
app.use(helmet({
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
}));
```

## 🔄 CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy Auth Service

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install pnpm
      run: npm install -g pnpm
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Run tests
      run: pnpm test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
    
    - name: Run linting
      run: pnpm lint
    
    - name: Type check
      run: pnpm typecheck

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: |
          ghcr.io/${{ github.repository }}:latest
          ghcr.io/${{ github.repository }}:${{ github.sha }}
    
    - name: Deploy to production
      run: |
        # Your deployment commands here
        echo "Deploying to production..."
```

## 📈 Performance Optimization

### Database Optimization
```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_users_username ON users(username);
CREATE INDEX CONCURRENTLY idx_users_is_active ON users(is_active) WHERE is_active = true;

-- Analyze table statistics
ANALYZE users;
```

### Caching Strategy
```typescript
// Redis caching implementation
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

// Cache user data
export const cacheUser = async (userId: string, userData: any, ttl = 3600) => {
  await redis.setex(`user:${userId}`, ttl, JSON.stringify(userData));
};

// Get cached user
export const getCachedUser = async (userId: string) => {
  const cached = await redis.get(`user:${userId}`);
  return cached ? JSON.parse(cached) : null;
};
```

### Load Balancing
```nginx
# Upstream configuration for multiple instances
upstream auth_service {
    least_conn;
    server 127.0.0.1:4000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:4001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:4002 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://auth_service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Timeout**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Increase connection timeout
export PGCONNECT_TIMEOUT=10
```

2. **Memory Issues**
```bash
# Monitor memory usage
free -h
top -p $(pgrep -f "node.*server.js")

# Increase Node.js memory limit
node --max-old-space-size=2048 dist/server.js
```

3. **Port Already in Use**
```bash
# Find process using port 4000
sudo lsof -i :4000

# Kill process
sudo kill -9 <PID>
```

### Health Check Failures
```bash
# Check service status
sudo systemctl status auth-service

# View logs
sudo journalctl -u auth-service -f

# Test health endpoint
curl -f http://localhost:4000/api/v1/healthcheck/simple
```

---

**🎉 Your Auth Service is now production-ready!**
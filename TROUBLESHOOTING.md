# Troubleshooting Guide

Common issues and solutions for the Auth Service.

## 🚨 Quick Diagnostics

### Health Check Status
```bash
# Check service health
curl http://localhost:4000/api/v1/healthcheck

# Check simple health (no database dependency)
curl http://localhost:4000/api/v1/healthcheck/simple
```

### Service Status
```bash
# Check if service is running
ps aux | grep "node.*server.js"

# Check port availability
netstat -tlnp | grep :4000
# or
ss -tlnp | grep :4000
```

### Log Files
```bash
# View application logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# View systemd logs (if using systemd)
sudo journalctl -u auth-service -f
```

## 🔧 Common Issues & Solutions

### 1. Database Connection Issues

#### Problem: "Database connection failed"
```json
{
  "statusCode": 503,
  "success": false,
  "message": "Health Check Failed - Database Disconnected"
}
```

**Solutions:**

**Check DATABASE_URL format:**
```bash
# Test database connection directly
psql $DATABASE_URL -c "SELECT 1;"

# Common format issues
# ❌ Wrong: postgresql://user@host/db
# ✅ Correct: postgresql://user:password@host:5432/db
```

**Verify database is running:**
```bash
# For PostgreSQL
sudo systemctl status postgresql

# For Neon/Cloud DB
ping your-neon-hostname
```

**Check connection string:**
```bash
# Parse and validate DATABASE_URL
node -e "
const url = new URL(process.env.DATABASE_URL);
console.log('Host:', url.hostname);
console.log('Port:', url.port || '5432');
console.log('Database:', url.pathname.slice(1));
console.log('Username:', url.username);
"
```

**Fix connection timeout:**
```typescript
// src/config/db.ts
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 10000, // Increase timeout
  ssl: {
    rejectUnauthorized: false // For cloud databases
  }
});
```

### 2. Environment Variable Issues

#### Problem: "Environment validation failed"
```bash
Error: Missing required environment variable: ACCESS_TOKEN_SECRET
```

**Solutions:**

**Check .env file:**
```bash
# Verify .env file exists
ls -la .env

# Check file permissions
chmod 600 .env

# Verify variables are set
grep -E "^(ACCESS_TOKEN_SECRET|REFRESH_TOKEN_SECRET|DATABASE_URL)" .env
```

**Validate secret lengths:**
```bash
# Check minimum 32 characters for secrets
node -e "
const secrets = ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET', 'EXPRESS_SESSION_SECRET'];
secrets.forEach(secret => {
  const value = process.env[secret];
  console.log(secret + ':', value ? value.length + ' chars' : 'MISSING');
  if (value && value.length < 32) {
    console.log('❌ Too short - needs 32+ characters');
  }
});
"
```

**Reload environment variables:**
```bash
# Restart service to pick up new env vars
pkill -f "node.*server.js"
pnpm dev
```

### 3. Port Already in Use

#### Problem: "EADDRINUSE: address already in use :::4000"

**Solutions:**

**Find and kill process:**
```bash
# Find process using port 4000
sudo lsof -i :4000

# Kill process
sudo kill -9 <PID>

# Or kill all node processes
pkill -f node
```

**Change port:**
```env
# In .env file
PORT=4001
```

### 4. JWT Token Issues

#### Problem: "JsonWebTokenError: invalid signature"

**Solutions:**

**Check JWT secrets:**
```bash
# Verify secrets are set and consistent
echo "ACCESS_TOKEN_SECRET length: ${#ACCESS_TOKEN_SECRET}"
echo "REFRESH_TOKEN_SECRET length: ${#REFRESH_TOKEN_SECRET}"
```

**Regenerate tokens:**
```bash
# Clear all user refresh tokens in database
psql $DATABASE_URL -c "UPDATE users SET refresh_token = NULL;"
```

**Verify token format:**
```bash
# Decode JWT token (without verification)
node -e "
const token = 'your.jwt.token';
const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
console.log('Token payload:', decoded);
"
```

### 5. Email Service Issues

#### Problem: "Email send failed"

**Solutions:**

**Verify Resend API key:**
```bash
# Test Resend API
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "'$RESEND_FROM_EMAIL'",
    "to": ["test@example.com"],
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

**Check from email domain:**
```bash
# Verify domain is verified in Resend
# Go to https://resend.com/domains
```

**Check email configuration:**
```typescript
// src/utils/mail.ts
console.log('Email config:', {
  apiKey: process.env.RESEND_API_KEY ? 'SET' : 'MISSING',
  fromEmail: process.env.RESEND_FROM_EMAIL
});
```

### 6. CORS Issues

#### Problem: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solutions:**

**Check allowed origins:**
```bash
# Verify CORS configuration
echo "ALLOWED_ORIGINS: $ALLOWED_ORIGINS"
```

**Test preflight request:**
```bash
# Test OPTIONS request
curl -X OPTIONS http://localhost:4000/api/v1/users/register \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Fix CORS configuration:**
```typescript
// src/app.ts
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
```

### 7. Rate Limiting Issues

#### Problem: "Too many authentication attempts"

**Solutions:**

**Check rate limit status:**
```bash
# View rate limit headers
curl -I http://localhost:4000/api/v1/users/register
```

**Reset rate limiting:**
```bash
# Restart service to clear rate limits
pkill -f "node.*server.js"
pnpm dev
```

**Adjust rate limiting:**
```typescript
// src/app.ts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increase limit for testing
  message: "Too many authentication attempts, please try again later."
});
```

### 8. Memory Issues

#### Problem: "JavaScript heap out of memory"

**Solutions:**

**Increase Node.js memory:**
```bash
# Start with increased memory
node --max-old-space-size=4096 dist/server.js

# Or in package.json
"start": "node --max-old-space-size=4096 dist/server.js"
```

**Monitor memory usage:**
```bash
# Check memory usage
ps aux | grep "node.*server.js"

# Detailed memory info
cat /proc/<PID>/status | grep -E "VmSize|VmRSS"
```

### 9. SSL/HTTPS Issues

#### Problem: "SSL handshake failed"

**Solutions:**

**Check SSL configuration:**
```bash
# Test SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

**Fix database SSL:**
```typescript
// src/config/db.ts
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Allow self-signed certs for development
  }
});
```

### 10. OAuth Issues

#### Problem: "OAuth authentication failed"

**Solutions:**

**Check OAuth configuration:**
```bash
# Verify Google OAuth
echo "Google Client ID: $GOOGLE_CLIENT_ID"
echo "Google Client Secret: ${GOOGLE_CLIENT_SECRET:0:10}..."

# Verify GitHub OAuth
echo "GitHub Client ID: $GITHUB_CLIENT_ID"
echo "GitHub Client Secret: ${GITHUB_CLIENT_SECRET:0:10}..."
```

**Check redirect URLs:**
```bash
# Verify callback URLs are configured correctly
# Google Console: https://console.cloud.google.com/
# GitHub Settings: https://github.com/settings/developers
```

## 🐛 Debug Mode

### Enable Debug Logging

```typescript
// src/app.ts
// Enable debug mode
if (process.env.DEBUG === 'true') {
  app.use((req, res, next) => {
    console.log('🔍 Debug Request:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    });
    next();
  });
}
```

### Database Query Debugging

```typescript
// src/config/db.ts
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(pool, { 
  schema: Schema,
  logger: true // Enable query logging
});
```

### Request/Response Debugging

```bash
# Use curl with verbose output
curl -v http://localhost:4000/api/v1/healthcheck

# Use httpie for better formatting
http -v GET localhost:4000/api/v1/healthcheck
```

## 📊 Performance Issues

### Slow Database Queries

**Identify slow queries:**
```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 100; -- Log queries > 100ms
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

**Add database indexes:**
```sql
-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_users_username ON users(username);
CREATE INDEX CONCURRENTLY idx_users_active ON users(is_active) WHERE is_active = true;
```

### High Memory Usage

**Monitor Node.js memory:**
```bash
# Enable heap snapshots
node --inspect dist/server.js

# Use Chrome DevTools for memory profiling
# Open chrome://inspect and connect to the process
```

**Optimize database connections:**
```typescript
// src/config/db.ts
const pool = new Pool({
  max: 10, // Reduce max connections
  idleTimeoutMillis: 10000, // Reduce idle timeout
  connectionTimeoutMillis: 5000
});
```

## 🔍 Service Recovery

### Complete Service Reset

```bash
#!/bin/bash
# reset-service.sh

echo "🔄 Resetting Auth Service..."

# Stop service
pkill -f "node.*server.js" || true

# Clear logs
> logs/combined.log
> logs/error.log

# Reset database (optional)
read -p "Reset database? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  pnpm db:drop
  pnpm db:migrate
fi

# Clear rate limits
redis-cli FLUSHALL || echo "Redis not available"

# Start service
pnpm dev

echo "✅ Service reset complete"
```

### Database Recovery

```bash
# Check database status
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Repair corrupted tables
psql $DATABASE_URL -c "VACUUM ANALYZE users;"

# Rebuild indexes
psql $DATABASE_URL -c "REINDEX DATABASE;"
```

### Emergency Rollback

```bash
# Rollback to previous migration
pnpm drizzle-kit rollback

# Restore from backup
psql $DATABASE_URL < backup.sql
```

## 📞 Getting Help

### Log Collection

```bash
# Collect diagnostic information
./collect-diagnostics.sh
```

Create `collect-diagnostics.sh`:
```bash
#!/bin/bash
# collect-diagnostics.sh

echo "📊 Collecting diagnostics..."

DIR="diagnostics-$(date +%Y%m%d-%H%M%S)"
mkdir -p $DIR

# System info
uname -a > $DIR/system.txt
free -h >> $DIR/system.txt
df -h >> $DIR/system.txt

# Node.js info
node --version > $DIR/nodejs.txt
npm list --depth=0 >> $DIR/nodejs.txt

# Service status
ps aux | grep "node.*server.js" > $DIR/service-status.txt
netstat -tlnp | grep :4000 >> $DIR/service-status.txt

# Environment variables
env | grep -E "^(NODE_ENV|PORT|DATABASE|ACCESS|REFRESH|RESEND)" > $DIR/environment.txt

# Logs
tail -100 logs/combined.log > $DIR/combined.log
tail -100 logs/error.log > $DIR/error.log

# Health check
curl -s http://localhost:4000/api/v1/healthcheck > $DIR/health-check.json

echo "📦 Diagnostics collected in: $DIR"
tar -czf $DIR.tar.gz $DIR
```

### Issue Reporting Template

```markdown
## Issue Description
Brief description of the problem

## Environment
- Node.js version:
- OS:
- Database:
- Deployment type:

## Error Messages
```
Paste error messages here
```

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Additional Context
- Configuration changes
- Recent deployments
- Related issues
```

---

**🔧 If you're still stuck, check the [FAQ](./FAQ.md) or open an issue!**
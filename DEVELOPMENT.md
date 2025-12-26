# Development Guide

Complete guide for developing and contributing to the Auth Service.

## 🛠 Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database
- pnpm package manager
- Git

### Local Development

1. **Clone Repository**
```bash
git clone <repository-url>
cd auth-service
```

2. **Install Dependencies**
```bash
pnpm install
```

3. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your development configuration
```

4. **Database Setup**
```bash
# Create development database
createdb auth_service_dev

# Run migrations
pnpm db:migrate

# (Optional) Seed with test data
pnpm db:seed
```

5. **Start Development Server**
```bash
pnpm dev
```

The server will start at `http://localhost:4000` with hot reload enabled.

## 📁 Project Structure

```
auth-service/
├── src/
│   ├── config/              # Configuration files
│   │   ├── db.ts           # Database configuration
│   │   └── env.ts          # Environment validation
│   ├── controllers/         # Route controllers
│   │   └── auth/
│   │       └── user.controller.ts
│   ├── db/                 # Database schema
│   │   ├── schema/
│   │   │   ├── index.ts
│   │   │   └── user.ts
│   │   └── migrations/     # Database migrations
│   ├── lib/                # External libraries
│   │   └── posthog.ts
│   ├── logger/             # Logging configuration
│   │   ├── morgan.logger.ts
│   │   └── winston.logger.ts
│   ├── middlewares/        # Express middlewares
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validate.middleware.ts
│   ├── passport/           # OAuth strategies
│   │   └── index.ts
│   ├── routes/             # API routes
│   │   ├── auth/
│   │   │   └── user.routes.ts
│   │   └── healthcheck.routes.ts
│   ├── types/              # TypeScript types
│   │   └── express.d.ts
│   ├── utils/              # Utility functions
│   │   ├── ApiError.ts
│   │   ├── ApiResponse.ts
│   │   ├── asyncHandler.ts
│   │   ├── mail.ts
│   │   └── token.ts
│   ├── validators/         # Input validation schemas
│   │   └── auth.validator.ts
│   ├── app.ts              # Express app configuration
│   └── server.ts           # Server entry point
├── drizzle/                # Drizzle ORM files
├── docs/                   # Documentation
├── tests/                  # Test files
├── .env.example           # Environment template
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── drizzle.config.ts      # Drizzle configuration
└── README.md              # Main documentation
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test auth.test.ts
```

### Test Structure
```
tests/
├── unit/                   # Unit tests
│   ├── controllers/
│   ├── utils/
│   └── validators/
├── integration/            # Integration tests
│   ├── auth/
│   └── database/
└── e2e/                   # End-to-end tests
    └── api/
```

### Writing Tests

#### Unit Test Example
```typescript
// tests/unit/utils/token.test.ts
import { generateTokens } from '../../../src/utils/token';

describe('Token Utils', () => {
  it('should generate access and refresh tokens', () => {
    const userId = 'test-user-id';
    const tokens = generateTokens(userId);
    
    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
  });
});
```

#### Integration Test Example
```typescript
// tests/integration/auth/register.test.ts
import request from 'supertest';
import { app } from '../../../src/app';

describe('User Registration', () => {
  it('should register a new user', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPass123!',
      fullName: 'Test User'
    };

    const response = await request(app)
      .post('/api/v1/users/register')
      .send(userData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(userData.email);
  });
});
```

## 🔧 Available Scripts

### Development Scripts
```bash
pnpm dev              # Start development server with hot reload
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues automatically
pnpm typecheck        # Run TypeScript type checking
pnpm format           # Format code with Prettier
```

### Database Scripts
```bash
pnpm db:migrate       # Run database migrations
pnpm db:generate      # Generate new migration
pnpm db:push          # Push schema changes to database
pnpm db:drop          # Drop database
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed database with test data
```

### Testing Scripts
```bash
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests only
pnpm test:integration # Run integration tests only
pnpm test:e2e         # Run end-to-end tests
pnpm test:coverage    # Run tests with coverage report
pnpm test:watch       # Run tests in watch mode
```

## 🗄 Database Development

### Schema Changes

1. **Modify Schema Files**
```typescript
// src/db/schema/user.ts
export const User = pgTable("users", {
  // Add new fields here
  newField: text("new_field").notNull().default("default_value"),
});
```

2. **Generate Migration**
```bash
pnpm db:generate
```

3. **Apply Migration**
```bash
pnpm db:migrate
```

### Database Studio
```bash
pnpm db:studio
```
Opens Drizzle Studio at `http://localhost:3000` for database management.

### Seeding Data
```typescript
// scripts/seed.ts
import { db } from '../src/config/db';
import { User } from '../src/db/schema';

async function seed() {
  await db.insert(User).values([
    {
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      fullName: 'Admin User',
      role: 'admin'
    }
  ]);
}

seed().catch(console.error);
```

## 🔍 Debugging

### VS Code Configuration

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Auth Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "tsx/cjs"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debugging Tips

1. **Use Winston Logger**
```typescript
import logger from '../src/logger/winston.logger';

logger.info('User registered successfully', { userId });
logger.error('Database connection failed', { error });
```

2. **Database Query Debugging**
```typescript
// Enable query logging in development
const db = drizzle(pool, { 
  schema: Schema,
  logger: true
});
```

3. **Request Debugging**
```typescript
// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});
```

## 📝 Code Style

### ESLint Configuration
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### TypeScript Best Practices

1. **Use Strict Types**
```typescript
// Good
interface User {
  id: string;
  email: string;
  username: string;
}

// Bad
interface User {
  id: any;
  email: any;
  username: any;
}
```

2. **Error Handling**
```typescript
// Use asyncHandler for route handlers
const createUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const user = await userService.create(req.body);
    res.status(201).json(new ApiResponse(201, user));
  } catch (error) {
    throw new ApiError(400, "Failed to create user");
  }
});
```

3. **Validation**
```typescript
// Use Zod for runtime validation
const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3)
});
```

## 🔄 Git Workflow

### Branch Naming
- `feature/feature-name` - New features
- `bugfix/bug-description` - Bug fixes
- `hotfix/urgent-fix` - Critical fixes
- `docs/documentation-update` - Documentation updates

### Commit Messages
```
feat: add user registration endpoint
fix: resolve database connection timeout
docs: update API documentation
refactor: improve error handling
test: add unit tests for token utils
```

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
```

## 🚀 Performance Optimization

### Database Optimization
```typescript
// Use indexes for frequently queried fields
export const User = pgTable("users", {
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  // Add indexes
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  usernameIdx: index("username_idx").on(table.username)
}));
```

### Caching Strategy
```typescript
// Implement Redis caching for frequently accessed data
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache user data
const cacheUser = async (userId: string, userData: any) => {
  await redis.setex(`user:${userId}`, 3600, JSON.stringify(userData));
};
```

### Request Optimization
```typescript
// Use connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Implement request batching
const batchUsers = async (userIds: string[]) => {
  return await db.select().from(User).where(inArray(User.id, userIds));
};
```

## 🔐 Security Best Practices

### Input Validation
```typescript
// Always validate user input
const validatedData = userSchema.parse(req.body);
```

### Error Handling
```typescript
// Don't expose sensitive information in errors
const handleError = (error: Error) => {
  if (process.env.NODE_ENV === 'production') {
    return new ApiError(500, "Internal server error");
  }
  return new ApiError(500, error.message);
};
```

### Authentication
```typescript
// Use secure cookie settings
app.use(cookieParser({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict'
}));
```

## 📚 Learning Resources

- **Express.js**: https://expressjs.com/
- **TypeScript**: https://www.typescriptlang.org/
- **Drizzle ORM**: https://orm.drizzle.team/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **JWT**: https://jwt.io/
- **Zod**: https://zod.dev/

---

**Happy Coding! 🎉**
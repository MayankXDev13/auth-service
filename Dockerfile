# Stage 1: Dependencies

FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN corepack enable \
    && pnpm install --frozen-lockfile



# Stage 2: Builder

FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY tsconfig*.json ./
COPY src ./src

RUN corepack enable \
    && pnpm build


# Stage 3: Production

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN corepack enable \
    && pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 3000

CMD ["pnpm", "start"]
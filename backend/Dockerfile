# Multi-Stage Production Dockerfile for ADAPTS Backend
# Stage 1: Build TypeScript source
FROM node:20-alpine AS builder

WORKDIR /app

# Install package definitions
COPY package*.json ./
RUN npm ci

# Copy TypeScript source and config
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to dist/
RUN npm run build

# Prune devDependencies
RUN npm prune --production

# Stage 2: Minimal Production Image
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Install g++ and make for C++ compilation sandbox (Trial 13)
RUN apk add --no-cache g++ make docker-cli

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root system user for secure container execution
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy compiled artifacts and production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/dist/ ./dist/

# Change file ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]

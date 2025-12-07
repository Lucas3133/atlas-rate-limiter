# ================================================================
# ATLAS RATE LIMITER - DOCKERFILE MULTI-STAGE
# ================================================================
# OPS-001: Optimized image for production
# ================================================================

# ============================================================
# STAGE 1: Build (Dependencies)
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only package files first (cache layer)
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# ============================================================
# STAGE 2: Runtime (Production)
# ============================================================
FROM node:20-alpine

# Metadata
LABEL maintainer="Atlas Shield Team"
LABEL description="High-performance distributed rate limiter with Redis"
LABEL version="1.0.0-beta"

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs package*.json ./

# Switch to non-root user
USER nodejs

# Expose port (configurable via ENV)
EXPOSE 3000

# Health check (Railway/Render use this)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Startup command
CMD ["node", "src/index.js"]

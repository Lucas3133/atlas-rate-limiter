# ================================================================
# ATLAS RATE LIMITER - DOCKERFILE MULTI-STAGE
# ================================================================
# OPS-001: Imagem otimizada para produção
# ================================================================

# ============================================================
# STAGE 1: Build (Dependências)
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar apenas package files primeiro (cache layer)
COPY package*.json ./

# Instalar APENAS dependências de produção
RUN npm ci --only=production && \
    npm cache clean --force

# ============================================================
# STAGE 2: Runtime (Produção)
# ============================================================
FROM node:20-alpine

# Metadata
LABEL maintainer="Atlas Shield Team"
LABEL description="High-performance distributed rate limiter with Redis"
LABEL version="1.0.0-beta"

# Segurança: Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copiar node_modules do builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copiar código-fonte
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs package*.json ./

# Mudar para usuário não-root
USER nodejs

# Expor porta (configurável via ENV)
EXPOSE 3000

# Health check (Railway/Render usam isso)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Comando de inicialização
CMD ["node", "src/index.js"]

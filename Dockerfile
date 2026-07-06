# ============ 阶段1：安装所有依赖 ============
FROM node:20-alpine AS deps
WORKDIR /app

# 复制根 lockfile 和所有 workspace 的 package.json（npm workspaces 需要 root lockfile）
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci

# ============ 阶段2：构建前端 ============
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/client/package.json ./client/
COPY client/ ./client/
RUN npm run build -w client

# ============ 阶段3：构建后端 ============
FROM node:20-alpine AS server-builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/server/package.json ./server/
COPY server/ ./server/
RUN npm run build -w server

# ============ 阶段4：生产依赖（仅 server 的运行时依赖） ============
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --omit=dev -w server

# ============ 阶段5：运行 ============
FROM node:20-alpine

# OCI 镜像元数据
LABEL org.opencontainers.image.title="Mail Hub"
LABEL org.opencontainers.image.description="邮箱聚合管理系统 — 统一管理多个邮箱账户，支持收件、发件、邮件转发与通知推送"
LABEL org.opencontainers.image.url="https://github.com/rzh0001/mail"
LABEL org.opencontainers.image.source="https://github.com/rzh0001/mail"
LABEL org.opencontainers.image.licenses="Mail Hub Non-Commercial License"

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=client-builder --chown=appuser:appgroup /app/client/dist ./client/dist
COPY --from=server-builder --chown=appuser:appgroup /app/server/dist ./server/dist
COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./server/node_modules
COPY --from=prod-deps --chown=appuser:appgroup /app/server/package.json ./server/

RUN mkdir -p /app/server/data && chown appuser:appgroup /app/server/data

VOLUME /app/server/data
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api || exit 1

USER appuser
ENV NODE_ENV=production
CMD ["node", "server/dist/index.js"]

# ============ 阶段1：构建前端 ============
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ============ 阶段2：构建后端 ============
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npm run build
RUN npm prune --production

# ============ 阶段3：运行 ============
FROM node:20-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=client-builder --chown=appuser:appgroup /app/client/dist ./client/dist
COPY --from=server-builder --chown=appuser:appgroup /app/server/dist ./server/dist
COPY --from=server-builder --chown=appuser:appgroup /app/server/node_modules ./server/node_modules
COPY --from=server-builder --chown=appuser:appgroup /app/server/package.json ./server/

RUN mkdir -p /app/server/data && chown appuser:appgroup /app/server/data

VOLUME /app/server/data
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api || exit 1

USER appuser
ENV NODE_ENV=production
CMD ["node", "server/dist/index.js"]

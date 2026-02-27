# Multi-stage Dockerfile for Spanish Law MCP
#
# IMPORTANT: The database must be pre-built BEFORE running docker build.
#
# Build:
#   npm run build
#   docker build -t spanish-law-mcp .
#
# Run (HTTP mode for Fly.io):
#   docker run -p 8080:8080 spanish-law-mcp
#
# Run (stdio mode):
#   docker run -i spanish-law-mcp node dist/index.js

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY data/database.db ./data/database.db

RUN addgroup -S nodejs && adduser -S nodejs -G nodejs \
 && chown -R nodejs:nodejs /app/data
USER nodejs

ENV NODE_ENV=production
ENV SPANISH_LAW_DB_PATH=/app/data/database.db
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/serve.js"]

# =============================================================================
# Multi-stage Dockerfile for CTA Transit Tracker
# Stage 1: Build the Expo web frontend
# Stage 2: Production Node.js backend serving API + static frontend
# =============================================================================

# ---- Stage 1: Build frontend ------------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./
RUN npx expo export --platform web

# ---- Stage 2: Production backend --------------------------------------------
FROM node:20-alpine

RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copy backend source
COPY backend/ ./

# Copy built frontend into a static directory the backend can serve
COPY --from=frontend-build /app/dist ./public

# Non-root user for security
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]

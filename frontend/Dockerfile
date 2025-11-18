# syntax=docker/dockerfile:1

# Install production dependencies using a clean, reproducible lockfile.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build the Next.js app. Runtime configuration (NEXT_PUBLIC_*) values are baked in here.
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Create a lean runtime image that only contains the production server.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
EXPOSE 3000

# Run the app as a non-root user to satisfy most hosting platforms.
RUN addgroup -g 1001 nextjs && \
    adduser -S -G nextjs -u 1001 nextjs

# Copy the minimal Next.js standalone build output into the runtime image.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
CMD ["node", "server.js"]

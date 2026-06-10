FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace files
COPY package.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm ci --workspace=apps/api --workspace=packages/shared
RUN cd apps/api && npx tsc

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Run as non-root user for security
RUN addgroup -S vault && adduser -S vault -G vault
USER vault

CMD ["node", "dist/index.js"]

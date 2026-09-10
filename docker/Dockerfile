FROM node:26-bookworm-slim AS base
RUN npm install -g pnpm@11.5.0
WORKDIR /app
FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/integrations/package.json packages/integrations/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN pnpm --filter @family/api deploy --prod --legacy /runtime
FROM node:26-bookworm-slim AS api
WORKDIR /app
COPY --from=build /runtime /app
COPY --from=build /app/packages/database/migrations /app/migrations
ENV NODE_ENV=production DATABASE_PATH=/data/medicine.db MIGRATIONS_PATH=/app/migrations
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3001
CMD ["node","dist/server.js"]
FROM nginx:stable-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

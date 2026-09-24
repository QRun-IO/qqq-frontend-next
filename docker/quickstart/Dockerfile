FROM registry-1.docker.io/library/node:22-bookworm-slim AS frontend
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV QQQ_BACKEND_URL=http://host.docker.internal:8000
ENV NEXT_PUBLIC_MOCK_API=false
RUN pnpm build

FROM registry-1.docker.io/library/node:22-bookworm-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/QRun-IO/qqq-frontend-next"
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=frontend --chown=node:node /app/.next/standalone ./
COPY --from=frontend --chown=node:node /app/.next/static ./.next/static
COPY --from=frontend --chown=node:node /app/public ./public
COPY LICENSE ./LICENSE
USER node
EXPOSE 3000
CMD ["node", "server.js"]

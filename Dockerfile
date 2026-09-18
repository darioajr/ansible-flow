FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm prepare:assets && pnpm --filter @visual-ansible/web build

FROM node:22-alpine AS runtime
WORKDIR /app
# The standalone server only needs Node; package managers are build-time tools.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DATA_DIR=/data
COPY --from=builder --chown=1001:0 /app/apps/web/.next/standalone ./
COPY --from=builder --chown=1001:0 /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=1001:0 /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=1001:0 /app/LICENSE /app/LICENSE-MIT /app/NOTICE ./
RUN mkdir -p /data && chown 1001:0 /data && chmod -R g=u /app /data
USER 1001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

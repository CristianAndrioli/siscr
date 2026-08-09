# linux/amd64 — exigido pelo Cloudflare Containers
FROM node:20-bookworm-slim

WORKDIR /app

# Runtime Node da ponte (sem deps do Worker)
COPY docker-package.json package.json
RUN npm install --omit=dev

COPY src/server.ts ./src/server.ts

ENV PORT=8788
EXPOSE 8788

CMD ["npx", "tsx", "src/server.ts"]

# linux/amd64 — exigido pelo Cloudflare Containers
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY docker-package.json package.json
RUN npm install --omit=dev

COPY src/server.ts ./src/server.ts
# Cadeia ICP-Brasil (SEFAZ usa SSL EV Soluti / Raiz v10 — fora do Mozilla CA)
COPY certs/icp-brasil-https-cas.pem ./certs/icp-brasil-https-cas.pem

ENV PORT=8788
ENV NODE_EXTRA_CA_CERTS=/app/certs/icp-brasil-https-cas.pem
EXPOSE 8788

CMD ["npx", "tsx", "src/server.ts"]

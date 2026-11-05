FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# prisma + scripts are needed by the postinstall generator.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run prisma:generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]

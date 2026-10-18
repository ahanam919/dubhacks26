FROM node:22-slim
WORKDIR /app

# Packages for ai/ (installed at the root, where ai/ looks for them)
COPY package*.json ./
RUN npm ci

# Packages for the API
COPY api/package*.json ./api/
RUN cd api && npm ci

# Code (explicit folders, so nothing else from the repo root gets in)
COPY ai ./ai
COPY api ./api
COPY seed ./seed

ENV NODE_ENV=production
WORKDIR /app/api
EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]
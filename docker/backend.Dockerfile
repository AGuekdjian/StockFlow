FROM node:26-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci --omit=dev -w backend -w shared
FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY backend ./backend
COPY shared ./shared
RUN mkdir -p /app/data /app/logs /app/backups && chown -R node:node /app/data /app/logs /app/backups
USER node
EXPOSE 3000
CMD ["node", "backend/src/server.js"]

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci -w frontend -w shared
COPY frontend ./frontend
COPY shared ./shared
RUN npm run build -w frontend
FROM nginx:1.30-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80

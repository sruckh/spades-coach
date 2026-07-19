# syntax=docker/dockerfile:1

# ---- Build stage: compile the Vite static bundle (dist/) ----
FROM node:22-alpine AS build
WORKDIR /app

# Install deps against the lockfile first for cacheable layers.
COPY package.json package-lock.json ./
RUN npm ci

# Build the client-only static site. vite.config emits dist/index.html
# (renamed from app.html) so nginx's SPA fallback needs no extra config.
COPY . .
RUN npm run build

# ---- Serve stage: nginx serving the static dist/ on :80 ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

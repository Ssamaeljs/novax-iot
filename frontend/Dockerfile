FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NG_CLI_ANALYTICS=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY angular.json tsconfig.json tsconfig.app.json tsconfig.spec.json ./
COPY src ./src
COPY public ./public
RUN npm run build && test -f dist/novax-iot-app/browser/index.csr.html

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-api-proxy.conf /etc/nginx/novax-api-proxy.conf
COPY --from=build /app/dist/novax-iot-app/browser/ /usr/share/nginx/html/
EXPOSE 8080

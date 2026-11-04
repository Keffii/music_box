# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependency files first for better caching
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Empty API base: the app calls /api on its own origin and nginx proxies it to the backend
ARG REACT_APP_API_BASE=
ENV REACT_APP_API_BASE=${REACT_APP_API_BASE}

# Build the app
RUN npm run build

# Production stage with Nginx
FROM nginx:1.27-alpine

# Copy custom nginx config for React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=build /app/build /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 nginx-user && adduser -D -u 1001 -G nginx-user nginx-user

# Update nginx to run as non-root
RUN chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    chown -R nginx-user:nginx-user /etc/nginx/conf.d && \
    chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-user /var/run/nginx.pid

USER nginx-user

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
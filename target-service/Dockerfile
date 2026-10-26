# Lightweight Node.js 20/24 Alpine base image
FROM node:20-alpine

WORKDIR /app

# Copy package descriptors first to leverage Docker layer caching
COPY package*.json ./

RUN npm ci --only=production

# Copy application source code
COPY src/ ./src/

EXPOSE 5001

# Health check to demonstrate cloud container liveness
HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

CMD ["node", "src/server.js"]

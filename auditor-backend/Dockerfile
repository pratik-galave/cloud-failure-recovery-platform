# Node.js 22 Alpine base image (includes built-in node:sqlite)
FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create persistent storage folder for SQLite database
RUN mkdir -p /app/data

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000
ENV TARGET_SERVICE_URL=http://target-service:5001

CMD ["node", "src/server.js"]

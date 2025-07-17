FROM node:20-slim

WORKDIR /app

# Install only necessary system dependencies for better-sqlite3
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --omit=dev
RUN cd client && npm ci --omit=dev

# Copy application source
COPY . .

# Build client-side assets
RUN npm run build

# Create data directory for SQLite and PNG files
RUN mkdir -p /app/data/png

# Run database migrations
RUN npm run migrate

EXPOSE 3000

CMD ["node", "server/src/index.js"]

FROM node:20-alpine

# Install build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install backend dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Install client dependencies
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# Seed the database
RUN node src/db/seed.js

# Clean up build-only files to reduce image size
RUN rm -rf client/node_modules client/src client/vite.config.js client/tailwind.config.js client/postcss.config.js

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/index.js"]

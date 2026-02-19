FROM node:20-alpine AS base

# Install build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install backend dependencies
COPY package.json package-lock.json* ./
RUN npm install --production=false

# Install client dependencies and build frontend
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install

COPY . .
RUN cd client && npm run build

# Seed the database
RUN node src/db/seed.js

# Production stage
FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=base /app/src ./src
COPY --from=base /app/client/dist ./client/dist
COPY --from=base /app/propai.db ./propai.db

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]

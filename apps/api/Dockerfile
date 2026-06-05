# Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy packages
COPY packages/ ./packages/

# Copy API package
COPY apps/api/ ./apps/api/

# Install all dependencies
RUN npm install

# Build
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy packages
COPY packages/ ./packages/

# Copy API package
COPY apps/api/package*.json ./apps/api/
COPY apps/api/prisma/ ./apps/api/prisma/

# Install production dependencies
RUN npm install --workspace=apps/api --omit=dev

# Generate Prisma Client
WORKDIR /app/apps/api
RUN npx prisma generate

# Copy built code
COPY --from=builder /app/apps/api/dist ./dist

CMD ["npm", "start"]

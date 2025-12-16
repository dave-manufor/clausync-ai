# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --production
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
CMD ["npm", "start"]


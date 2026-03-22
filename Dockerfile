FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node ace build

FROM node:24-alpine
WORKDIR /app
RUN mkdir -p /tmp/librarian
COPY --from=builder /app/build ./
RUN npm ci --omit=dev
EXPOSE 3333
CMD ["node", "bin/server.js"]

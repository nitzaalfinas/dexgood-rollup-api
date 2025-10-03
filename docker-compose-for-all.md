docker-compose yang diletakkan pada parent direktori supaya bisa jalankan semua secara otomatis
```
services:
  # PostgreSQL Database
  rollup-db:
    image: postgres:15-alpine
    container_name: dexgood-bridge-postgres
    # restart: unless-stopped
    environment:
      POSTGRES_DB: dexgood_bridge
      POSTGRES_USER: bridge_user
      POSTGRES_PASSWORD: bridge_password
    ports:
      - "5432:5432"
    volumes:
      - ./DATABASE_PERSISTENCE:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bridge_user -d dexgood_bridge"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - rollupnet

  # Redis for Queue
  rollup-redis:
    image: redis:7
    container_name: dexgood-bridge-redis
    # restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - ./REDIS_PERSISTENCE:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - rollupnet

  # Bridge Backend API
  rollup-api:
    build:
      context: ./dexgood-rollup-api
      dockerfile: Dockerfile.development
    volumes:
      - ./dexgood-rollup-api/src:/app/src
      - ./dexgood-rollup-api/prisma:/app/prisma
      - ./dexgood-rollup-api/logs:/app/logs
      - /app/node_modules
    ports:
      - "3000:3000"
    env_file:
      - ./dexgood-rollup-api/.env.development
    depends_on:
      - rollup-db
      - rollup-redis
    # restart: unless-stopped
    networks:
      - rollupnet

  rollup-web:
    build:
      context: ./dexgood-rollup-web
      dockerfile: Dockerfile
    container_name: dexgood-bridge-web
    volumes:
      - ./dexgood-rollup-web:/app
      - /app/node_modules
    env_file:
      - ./dexgood-rollup-web/.env
    # restart: unless-stopped
    ports:
      - '5173:5173'
      - '4173:4173'
    # depends_on:
    #   - rollup-api
    networks:
      - rollupnet

networks:
  rollupnet:
    driver: bridge
```
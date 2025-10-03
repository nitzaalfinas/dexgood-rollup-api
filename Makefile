# Makefile for DexGood Bridge API

.PHONY: help install build dev start stop clean test lint format docker-up docker-down docker-rebuild logs db-migrate db-seed db-reset

# Default target
help:
	@echo "Available commands:"
	@echo "  install       - Install dependencies"
	@echo "  build         - Build the project"
	@echo "  dev           - Start development server"
	@echo "  start         - Start production server"
	@echo "  stop          - Stop all services"
	@echo "  clean         - Clean build files and dependencies"
	@echo "  test          - Run tests"
	@echo "  test-watch    - Run tests in watch mode"
	@echo "  lint          - Run linter"
	@echo "  format        - Format code"
	@echo "  docker-up     - Start Docker services"
	@echo "  docker-down   - Stop Docker services"
	@echo "  docker-rebuild- Rebuild and restart Docker services"
	@echo "  logs          - Show application logs"
	@echo "  db-migrate    - Run database migrations"
	@echo "  db-seed       - Seed database with initial data"
	@echo "  db-reset      - Reset database"

# Install dependencies
install:
	npm install

# Build the project
build:
	npm run build

# Start development server
dev:
	npm run dev

# Start production server
start:
	npm start

# Stop all services (if running in background)
stop:
	@echo "Stopping services..."
	@pkill -f "node.*bridge" || true
	@docker-compose down || true

# Clean build files and dependencies
clean:
	rm -rf dist/
	rm -rf node_modules/
	rm -rf logs/
	docker-compose down -v
	docker system prune -f

# Run tests
test:
	npm test

# Run tests in watch mode
test-watch:
	npm run test:watch

# Run linter
lint:
	npm run lint

# Format code
format:
	npm run format

# Start Docker services
docker-up:
	docker-compose up -d postgres redis
	@echo "Waiting for services to be ready..."
	@sleep 10
	@echo "Services are ready!"

# Stop Docker services
docker-down:
	docker-compose down

# Rebuild and restart Docker services
docker-rebuild:
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d

# Show logs
logs:
	docker-compose logs -f bridge-api

# Database operations
db-migrate:
	npx prisma migrate dev

db-seed:
	npx prisma db seed

db-reset:
	npx prisma migrate reset --force

# Development workflow
setup: install docker-up db-migrate
	@echo "Setup complete! Run 'make dev' to start development server"

# Full development start
dev-full: docker-up
	@echo "Starting development server..."
	npm run dev

# Production deployment
deploy: install build
	@echo "Deploying to production..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Health check
health:
	@curl -f http://localhost:3000/health/live || echo "Service is not healthy"

# Show service status
status:
	@echo "Docker services:"
	@docker-compose ps
	@echo "\nNode processes:"
	@ps aux | grep node | grep -v grep || echo "No Node processes running"

# Database utilities
db-studio:
	npx prisma studio

db-generate:
	npx prisma generate

db-push:
	npx prisma db push

# Testing utilities
test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

test-coverage:
	npm run test:coverage
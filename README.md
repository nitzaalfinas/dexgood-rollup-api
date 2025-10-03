# DexGood Bridge Backend

# DexGood Bridge API

A secure and robust backend service for handling cross-chain bridge operations between Layer 1 (Sepolia) and Layer 2 (GoodNet Testnet) networks. This service listens to L1 smart contract events and executes corresponding token minting operations on L2.

## 🚀 Features

- **Event Monitoring**: Real-time monitoring of L1 bridge contract events
- **Queue Processing**: Reliable job queue system using Bull Queue and Redis
- **Database Integration**: PostgreSQL with Prisma ORM for data persistence
- **Security**: Comprehensive security middleware with rate limiting and authentication
- **API Endpoints**: RESTful API for bridge operations and status monitoring
- **Health Checks**: Built-in health monitoring endpoints
- **Logging**: Structured logging with Winston
- **Docker Support**: Full containerization support
- **Testing**: Comprehensive test suite with Jest

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis with Bull Queue
- **Blockchain**: Ethers.js
- **Security**: Helmet, CORS, Rate Limiting
- **Testing**: Jest
- **Containerization**: Docker & Docker Compose

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Blockchain    │
│   (React)       │◄──►│   (Node.js)     │◄──►│   Networks      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    └─────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │   Redis Queue   │
                    │   (Bull)        │
                    └─────────────────┘
```

## 🚀 Features

### Core Bridge Functionality
- ✅ **Event Listening**: Real-time monitoring of L1 bridge deposits
- ✅ **Automated Processing**: Queue-based L2 token minting
- ✅ **Multi-Token Support**: ETH and ERC-20 token bridging
- ✅ **Confirmation Handling**: Configurable block confirmations
- ✅ **Retry Mechanism**: Automatic retry with exponential backoff

### Security & Reliability
- 🔐 **Private Key Management**: Secure wallet integration
- 🛡️ **Rate Limiting**: API protection against abuse
- 🔍 **Input Validation**: Comprehensive request validation
- 📊 **Health Monitoring**: System health checks and metrics
- 🚨 **Error Handling**: Comprehensive error tracking and logging

### API Features
- 📈 **Bridge Statistics**: Volume, success rates, and analytics
- 👤 **User Deposits**: Track user bridge history
- ⚙️ **Admin Dashboard**: System management and monitoring
- 🔌 **RESTful API**: Clean and documented endpoints

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis with Bull Queue
- **Blockchain**: Ethers.js for Web3 integration
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Winston for structured logging
- **Testing**: Jest for unit and integration tests

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dexgood-bridge-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   ```

5. **Start the services**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run build
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/dexgood_bridge"

# Redis
REDIS_URL="redis://localhost:6379"

# Blockchain Networks
L1_RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"
L2_RPC_URL="https://testnet-scan.dexgood.com/rpc"

# Smart Contracts
L1_BRIDGE_CONTRACT="0x..."
L2_BRIDGE_CONTRACT="0x..."

# Security
BRIDGE_PRIVATE_KEY="0x..."  # Use secure key management in production
JWT_SECRET="your-jwt-secret"
API_KEY_SECRET="your-api-key"

# Bridge Configuration
MIN_BRIDGE_AMOUNT="0.001"
MAX_BRIDGE_AMOUNT="1000"
CONFIRMATION_BLOCKS=12
```

### Database Schema

The system uses PostgreSQL with the following main tables:

- `bridge_deposits`: Track all bridge transactions
- `admin_users`: Admin user management
- `system_metrics`: System performance metrics
- `token_metrics`: Token-specific statistics
- `event_logs`: System event logging

## 📡 API Documentation

### Public Endpoints

#### Bridge Status
```http
GET /api/bridge/status
```

#### User Deposits
```http
GET /api/bridge/deposits/:userAddress?page=1&limit=10
```

#### Deposit Details
```http
GET /api/bridge/deposit/:depositId
```

#### Bridge Statistics
```http
GET /api/bridge/stats
```

#### Supported Tokens
```http
GET /api/bridge/tokens
```

### Admin Endpoints (Authentication Required)

#### Dashboard Data
```http
GET /api/admin/dashboard
Authorization: Bearer <jwt_token>
```

#### Manage Deposits
```http
GET /api/admin/deposits
POST /api/admin/deposits/:depositId/retry
POST /api/admin/deposits/:depositId/cancel
```

#### Queue Management
```http
GET /api/admin/queue/stats
POST /api/admin/queue/clean
```

### Health Check Endpoints

```http
GET /health          # Comprehensive health check
GET /health/ready    # Readiness probe
GET /health/live     # Liveness probe
```

## 🔄 Bridge Process Flow

1. **Event Detection**: Monitor L1 bridge contract for deposit events
2. **Validation**: Validate transaction and user eligibility
3. **Queue Processing**: Add to Redis queue for reliable processing
4. **Confirmation Wait**: Wait for required block confirmations
5. **L2 Execution**: Execute mint transaction on L2 network
6. **Status Update**: Update database with completion status

## 🔐 Security Considerations

### Production Deployment

1. **Key Management**: Use AWS KMS or similar for private key storage
2. **Network Security**: Deploy behind WAF and load balancer
3. **Database Security**: Enable encryption at rest and in transit
4. **API Security**: Implement proper authentication and authorization
5. **Monitoring**: Set up comprehensive logging and alerting

### Security Best Practices

- Regular security audits
- Dependency vulnerability scanning
- Rate limiting and DDoS protection
- Input validation and sanitization
- Error handling without information leakage

## 📊 Monitoring & Logging

### Health Checks
- Database connectivity
- Redis availability
- Blockchain provider status
- Event listener status

### Metrics
- Bridge transaction volume
- Success/failure rates
- Processing times
- Queue statistics

### Logging
- Structured logging with Winston
- Request/response logging
- Error tracking with stack traces
- Performance metrics

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t dexgood-bridge-backend .

# Run container
docker run -p 3000:3000 --env-file .env dexgood-bridge-backend
```

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Monitoring tools configured
- [ ] Backup procedures established
- [ ] Security audit completed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation wiki

---

**Note**: This is a testnet implementation. For mainnet deployment, ensure comprehensive security audits and proper key management procedures.
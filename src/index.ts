import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from '@/utils/logger';
import { errorHandler, notFound } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';

// Import routes
import healthRoutes from '@/routes/health';
import bridgeRoutes from '@/routes/bridge';
import adminRoutes from '@/routes/admin';

// Import bridge services
import { BridgeEventListener } from '@/services/BridgeEventListener';
import { BridgeProcessor } from '@/services/BridgeProcessor';
import { initializeRedis } from '@/config/redis';
import { initializeDatabaseSimple } from '@/config/database-simple';

// Load environment variables
dotenv.config({ path: '.env.development' });

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/bridge', bridgeRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'DexGood Bridge API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Initialize bridge services
let eventListener: BridgeEventListener;

// Start server
app.listen(PORT, async () => {
  logger.info(`🚀 Server is running on port ${PORT}`);
  logger.info(`📚 Health check: http://localhost:${PORT}/health/live`);
  logger.info(`🌐 API base URL: http://localhost:${PORT}/api`);
  
  // Initialize Database, Redis and bridge services
  try {
    console.log('\n🔧 Initializing Database...');
    await initializeDatabaseSimple();
    console.log('✅ Database initialized successfully!');
    
    console.log('🔧 Initializing Redis...');
    await initializeRedis();
    console.log('✅ Redis initialized successfully!');
    
    console.log('🔧 Initializing Bridge Services...');
    const bridgeProcessor = new BridgeProcessor();
    eventListener = new BridgeEventListener(bridgeProcessor);
    
    console.log('🚀 Starting Bridge Event Listener...');
    await eventListener.start();
    console.log('✅ Bridge Event Listener started successfully!\n');
  } catch (error) {
    console.error('❌ Failed to start Bridge services:', error);
    logger.error('Failed to start Bridge services:', error);
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  // Suppress filter not found errors as they're not critical for bridge operation
  if (error.message?.includes('filter not found') || 
      (error as any).error?.message?.includes('filter not found')) {
    logger.debug('Filter expired, this is normal RPC behavior');
    return;
  }
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  // Suppress filter not found errors
  if (typeof reason === 'object' && reason !== null) {
    const errorObj = reason as any;
    if (errorObj.error?.message?.includes('filter not found') ||
        errorObj.message?.includes('filter not found')) {
      logger.debug('Filter expired, this is normal RPC behavior');
      return;
    }
  }
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handlers
process.on('uncaughtException', (error) => {
  // Suppress filter not found errors
  if (error.message?.includes('filter not found') || 
      error.message?.includes('could not coalesce error')) {
    logger.debug('Suppressed filter error (normal RPC behavior)');
    return;
  }
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  // Suppress filter not found errors
  if (reason && typeof reason === 'object' && 
      'message' in reason && 
      (reason.message?.includes('filter not found') || 
       reason.message?.includes('could not coalesce error'))) {
    logger.debug('Suppressed filter rejection (normal RPC behavior)');
    return;
  }
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server'); 
  process.exit(0);
});
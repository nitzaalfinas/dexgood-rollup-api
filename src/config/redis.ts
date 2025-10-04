import * as Redis from 'redis';
import Queue from 'bull';
import { logger } from '@/utils/logger';

let redisClient: Redis.RedisClientType;
let bridgeQueue: Queue.Queue;

export async function initializeRedis(): Promise<void> {
  try {
    // Initialize Redis client
    redisClient = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis connection refused');
          return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max attempts reached');
          return new Error('Max attempts reached');
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    await redisClient.connect();

    // Initialize Bull queue
    bridgeQueue = new Queue('bridge processing', process.env.REDIS_URL || 'redis://localhost:6379', {
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: parseInt(process.env.JOB_RETRY_ATTEMPTS || '3'),
        backoff: {
          type: 'exponential',
          delay: parseInt(process.env.JOB_RETRY_DELAY || '5000'),
        },
      },
    });

    bridgeQueue.on('error', (error) => {
      logger.error('Bridge queue error:', error);
    });

    bridgeQueue.on('waiting', (jobId) => {
      logger.info(`Job ${jobId} is waiting`);
    });

    bridgeQueue.on('active', (job) => {
      logger.info(`Job ${job.id} started processing`);
    });

    bridgeQueue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed with result:`, result);
    });

    bridgeQueue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed:`, error);
    });

    logger.info('Redis and Bull queue initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
}

export function getRedisClient(): Redis.RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return redisClient;
}

export function getBridgeQueue(): Queue.Queue {
  if (!bridgeQueue) {
    throw new Error('Bridge queue not initialized. Call initializeRedis() first.');
  }
  return bridgeQueue;
}

export async function closeRedis(): Promise<void> {
  try {
    if (bridgeQueue) {
      await bridgeQueue.close();
      logger.info('Bridge queue closed');
    }
    
    if (redisClient) {
      await redisClient.disconnect();
      logger.info('Redis client disconnected');
    }
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
  }
}
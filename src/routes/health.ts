import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';

const router = Router();

// Liveness probe
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // TODO: Add actual health checks for database, redis, etc.
    const healthChecks = {
      database: 'healthy', // Replace with actual DB check
      redis: 'healthy',    // Replace with actual Redis check
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({
      status: 'ready',
      checks: healthChecks,
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'not ready',
      error: 'Service unavailable',
    });
  }
});

export default router;
import { Router } from 'express';
import { AdminController } from '@/controllers/adminController';
import { authMiddleware } from '@/middleware/auth';

const router = Router();

// Apply authentication middleware to all admin routes
router.use(authMiddleware);

// Dashboard
router.get('/dashboard', AdminController.getDashboard);

// Deposits management
router.get('/deposits', AdminController.getDeposits);
router.post('/deposits/:depositId/retry', AdminController.retryDeposit);
router.post('/deposits/:depositId/cancel', AdminController.cancelDeposit);

// Queue management
router.get('/queue/stats', AdminController.getQueueStats);
router.post('/queue/clean', AdminController.cleanQueue);

// Configuration
router.get('/config', AdminController.getConfig);
router.put('/config', AdminController.updateConfig);

export default router;
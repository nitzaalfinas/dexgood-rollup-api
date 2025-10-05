import { Router } from 'express';
import { BridgeController } from '@/controllers/bridgeController';

const router = Router();

// Bridge operations
router.post('/deposit', BridgeController.processDeposit);
router.get('/deposits/:address', BridgeController.getDeposits);
router.get('/deposit/:txHash', BridgeController.getDepositStatus);

// Debug endpoints
router.post('/debug/scan-events', BridgeController.scanHistoricalEvents);
router.get('/debug/status', BridgeController.getDebugStatus);

export default router;
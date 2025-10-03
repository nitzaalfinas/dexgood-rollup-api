import { Router } from 'express';
import { BridgeController } from '@/controllers/bridgeController';

const router = Router();

// Bridge operations
router.post('/deposit', BridgeController.processDeposit);
router.get('/deposits/:address', BridgeController.getDeposits);
router.get('/deposit/:txHash', BridgeController.getDepositStatus);

export default router;
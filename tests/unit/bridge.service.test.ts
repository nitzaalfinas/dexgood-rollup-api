import { BridgeService } from '../src/services/bridge.service';
import { BridgeStatus } from '../src/types/bridge.types';

// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    bridgeTransaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    supportedToken: {
      findUnique: jest.fn(),
    },
  })),
}));

describe('BridgeService', () => {
  let bridgeService: BridgeService;

  beforeEach(() => {
    bridgeService = new BridgeService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBridgeTransaction', () => {
    it('should create a bridge transaction successfully', async () => {
      const mockTransaction = {
        id: 'test-id',
        l1TxHash: '0x123',
        fromAddress: '0xabc',
        toAddress: '0xdef',
        tokenAddress: '0x456',
        amount: '1000000',
        status: BridgeStatus.PENDING,
        l1ChainId: 11155111,
        l2ChainId: 443,
      };

      const prismaMock = require('@prisma/client').PrismaClient();
      prismaMock.bridgeTransaction.create.mockResolvedValue(mockTransaction);

      const result = await bridgeService.createBridgeTransaction(
        '0x123',
        '0xabc',
        '0xdef',
        '0x456',
        '1000000',
        11155111,
        443
      );

      expect(result).toEqual(mockTransaction);
      expect(prismaMock.bridgeTransaction.create).toHaveBeenCalledWith({
        data: {
          l1TxHash: '0x123',
          fromAddress: '0xabc',
          toAddress: '0xdef',
          tokenAddress: '0x456',
          amount: '1000000',
          status: BridgeStatus.PENDING,
          l1ChainId: 11155111,
          l2ChainId: 443,
        },
      });
    });
  });

  describe('getBridgeTransaction', () => {
    it('should return bridge transaction by ID', async () => {
      const mockTransaction = {
        id: 'test-id',
        l1TxHash: '0x123',
        status: BridgeStatus.COMPLETED,
      };

      const prismaMock = require('@prisma/client').PrismaClient();
      prismaMock.bridgeTransaction.findUnique.mockResolvedValue(mockTransaction);

      const result = await bridgeService.getBridgeTransaction('test-id');

      expect(result).toEqual(mockTransaction);
      expect(prismaMock.bridgeTransaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should return null if transaction not found', async () => {
      const prismaMock = require('@prisma/client').PrismaClient();
      prismaMock.bridgeTransaction.findUnique.mockResolvedValue(null);

      const result = await bridgeService.getBridgeTransaction('non-existent');

      expect(result).toBeNull();
    });
  });
});
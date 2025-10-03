import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { BridgeProcessor } from './BridgeProcessor';
import { L1DepositEvent } from '@/types/bridge';

// ABI for L1 Bridge Contract events
const BRIDGE_L1_ABI = [
  "event DepositERC20(uint256 indexed depositId, address indexed user, address indexed token, uint256 amount, uint256 timestamp)",
  "event DepositETH(uint256 indexed depositId, address indexed user, uint256 amount, uint256 timestamp)",
];

export class BridgeEventListener {
  private l1Provider: ethers.JsonRpcProvider;
  private l1Contract: ethers.Contract;
  private bridgeProcessor: BridgeProcessor;
  private isListening: boolean = false;
  private lastProcessedBlock: number = 0;

  constructor(bridgeProcessor: BridgeProcessor) {
    this.bridgeProcessor = bridgeProcessor;
    
    // Initialize L1 provider
    const l1RpcUrl = process.env.L1_RPC_URL;
    if (!l1RpcUrl) {
      throw new Error('L1_RPC_URL not configured');
    }
    
    this.l1Provider = new ethers.JsonRpcProvider(l1RpcUrl);
    
    // Initialize L1 contract
    const l1BridgeContract = process.env.L1_BRIDGE_CONTRACT;
    if (!l1BridgeContract) {
      throw new Error('L1_BRIDGE_CONTRACT not configured');
    }
    
    this.l1Contract = new ethers.Contract(
      l1BridgeContract,
      BRIDGE_L1_ABI,
      this.l1Provider
    );
  }

  async start(): Promise<void> {
    try {
      if (this.isListening) {
        logger.warn('Event listener is already running');
        return;
      }

      // Get the current block number
      const currentBlock = await this.l1Provider.getBlockNumber();
      this.lastProcessedBlock = currentBlock;
      
      logger.info(`Starting event listener from block ${currentBlock}`);

      // Listen for DepositETH events
      this.l1Contract.on('DepositETH', async (depositId, user, amount, timestamp, event) => {
        await this.handleDepositETH(depositId, user, amount, timestamp, event);
      });

      // Listen for DepositERC20 events
      this.l1Contract.on('DepositERC20', async (depositId, user, token, amount, timestamp, event) => {
        await this.handleDepositERC20(depositId, user, token, amount, timestamp, event);
      });

      // Handle provider errors
      this.l1Provider.on('error', (error) => {
        logger.error('L1 Provider error:', error);
        this.handleProviderError(error);
      });

      this.isListening = true;
      logger.info('Bridge event listener started successfully');

      // Start periodic health check
      this.startHealthCheck();

    } catch (error) {
      logger.error('Failed to start event listener:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (!this.isListening) {
        logger.warn('Event listener is not running');
        return;
      }

      this.l1Contract.removeAllListeners();
      this.l1Provider.removeAllListeners();
      this.isListening = false;

      logger.info('Bridge event listener stopped');
    } catch (error) {
      logger.error('Error stopping event listener:', error);
      throw error;
    }
  }

  private async handleDepositETH(
    depositId: bigint,
    user: string,
    amount: bigint,
    timestamp: bigint,
    event: ethers.EventLog
  ): Promise<void> {
    try {
      logger.info('DepositETH event received:', {
        depositId: depositId.toString(),
        user,
        amount: ethers.formatEther(amount),
        timestamp: timestamp.toString(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
      });

      const depositEvent: L1DepositEvent = {
        depositId,
        user,
        token: ethers.ZeroAddress, // ETH
        amount,
        timestamp,
        transactionHash: event.transactionHash,
        blockNumber: BigInt(event.blockNumber),
      };

      // Process the deposit
      await this.bridgeProcessor.processL1Deposit(depositEvent);

    } catch (error) {
      logger.error('Error handling DepositETH event:', error);
      // TODO: Add error handling and retry mechanism
    }
  }

  private async handleDepositERC20(
    depositId: bigint,
    user: string,
    token: string,
    amount: bigint,
    timestamp: bigint,
    event: ethers.EventLog
  ): Promise<void> {
    try {
      logger.info('DepositERC20 event received:', {
        depositId: depositId.toString(),
        user,
        token,
        amount: amount.toString(),
        timestamp: timestamp.toString(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
      });

      const depositEvent: L1DepositEvent = {
        depositId,
        user,
        token,
        amount,
        timestamp,
        transactionHash: event.transactionHash,
        blockNumber: BigInt(event.blockNumber),
      };

      // Process the deposit
      await this.bridgeProcessor.processL1Deposit(depositEvent);

    } catch (error) {
      logger.error('Error handling DepositERC20 event:', error);
      // TODO: Add error handling and retry mechanism
    }
  }

  private async handleProviderError(error: Error): Promise<void> {
    logger.error('Provider error occurred, attempting to reconnect...', error);
    
    try {
      // Stop current listeners
      await this.stop();
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Restart listeners
      await this.start();
      
      logger.info('Successfully reconnected to provider');
    } catch (reconnectError) {
      logger.error('Failed to reconnect to provider:', reconnectError);
      // TODO: Implement exponential backoff retry
    }
  }

  private startHealthCheck(): void {
    // Check connection health every 30 seconds
    setInterval(async () => {
      try {
        const blockNumber = await this.l1Provider.getBlockNumber();
        
        if (blockNumber > this.lastProcessedBlock) {
          this.lastProcessedBlock = blockNumber;
          logger.debug(`Health check passed. Current block: ${blockNumber}`);
        }
      } catch (error) {
        logger.error('Health check failed:', error);
        await this.handleProviderError(error as Error);
      }
    }, 30000);
  }

  public getStatus(): {
    isListening: boolean;
    lastProcessedBlock: number;
    provider: string;
  } {
    return {
      isListening: this.isListening,
      lastProcessedBlock: this.lastProcessedBlock,
      provider: this.l1Provider.connection.url,
    };
  }
}
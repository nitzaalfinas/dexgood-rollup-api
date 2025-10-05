import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { BridgeProcessor } from './BridgeProcessor';
import { L1DepositEvent } from '@/types/bridge';

// ABI for L1 Bridge Contract - Transfer ownership hanya via MetaMask/wallet signing untuk keamanan
// Updated ABI with nonce parameter to match new contract
const BRIDGE_L1_ABI = [
  "event DepositERC20(uint256 indexed depositId, address indexed user, address indexed token, uint256 amount, uint256 nonce, uint256 timestamp)",
  "event DepositETH(uint256 indexed depositId, address indexed user, uint256 amount, uint256 nonce, uint256 timestamp)",
  "event OwnershipTransferred(address indexed previousAdmin, address indexed newAdmin)",
];

export class BridgeEventListener {
  private l1Provider: ethers.JsonRpcProvider;
  private l1Contract: ethers.Contract;
  private bridgeProcessor: BridgeProcessor;
  private isListening: boolean = false;
  private lastProcessedBlock: number = 0;

  constructor(bridgeProcessor: BridgeProcessor) {
    this.bridgeProcessor = bridgeProcessor;
    
    const l1RpcUrl = process.env.L1_RPC_URL;
    logger.info(`L1_RPC_URL: ${l1RpcUrl}`);
    if (!l1RpcUrl) {
      throw new Error('L1_RPC_URL not configured');
    }
    
    this.l1Provider = new ethers.JsonRpcProvider(l1RpcUrl);
    
    console.log('🔌 Testing L1 RPC connection...');
    this.l1Provider.getBlockNumber().then(blockNumber => {
      console.log(`✅ L1 RPC connection successful. Current block: ${blockNumber}`);
    }).catch(error => {
      console.log('❌ L1 RPC connection failed:', error.message);
    });
    
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

      const currentBlock = await this.l1Provider.getBlockNumber();
      this.lastProcessedBlock = currentBlock;
      
      logger.info(`Starting event listener from block ${currentBlock}`);

      console.log('🎧 Setting up DepositETH event listener...');
      this.l1Contract.on('DepositETH', this.handleDepositETH.bind(this));

      console.log('🎧 Setting up DepositERC20 event listener...');
      this.l1Contract.on('DepositERC20', this.handleDepositERC20.bind(this));

      // Add error handling for provider errors
      this.l1Provider.on('error', (error) => {
        this.handleProviderError(error);
      });

      this.isListening = true;
      logger.info('Bridge event listener started successfully');
      console.log('🎯 BRIDGE EVENT LISTENER STARTED');
      console.log('📡 Listening for L1 Bridge Events...');
      console.log(`🔗 L1 Contract: ${process.env.L1_BRIDGE_CONTRACT}`);
      console.log(`⛓️  Starting from block: ${currentBlock}`);
      console.log('=' .repeat(60));

      this.startHealthCheck();
      await this.checkRecentEvents(currentBlock);

    } catch (error) {
      console.log('❌ Failed to start event listener:', error);
      logger.error('Failed to start event listener:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (!this.isListening) {
        return;
      }

      this.l1Contract.removeAllListeners();
      this.l1Provider.removeAllListeners();
      this.isListening = false;

      logger.info('Bridge event listener stopped');
    } catch (error) {
      logger.error('Error stopping event listener:', error);
    }
  }

  private async handleDepositETH(depositId: bigint, user: string, amount: bigint, nonce: bigint, timestamp: bigint, event: ethers.EventLog): Promise<void> {
    try {
      console.log('\n🔥 NEW ETH DEPOSIT EVENT DETECTED!');
      console.log('=' .repeat(50));
      console.log(`💰 Deposit ID: ${depositId.toString()}`);
      console.log(`👤 User: ${user}`);
      console.log(`💎 Amount: ${ethers.formatEther(amount)} ETH`);
      console.log(`🔢 User Nonce: ${nonce.toString()}`);
      console.log(`⏰ Timestamp: ${new Date(Number(timestamp) * 1000).toISOString()}`);
      console.log(`📦 Block: ${event.blockNumber || 'pending'}`);
      console.log(`🔗 TX Hash: ${event.transactionHash || 'pending'}`);
      console.log('=' .repeat(50));
      
      logger.info('DepositETH event received:', {
        depositId: depositId.toString(),
        user,
        amount: ethers.formatEther(amount),
        nonce: nonce.toString(),
        timestamp: timestamp.toString(),
      });

      const depositEvent: L1DepositEvent = {
        depositId,
        user,
        token: ethers.ZeroAddress,
        amount,
        nonce,
        timestamp,
        transactionHash: event.transactionHash || 'unknown',
        blockNumber: BigInt(event.blockNumber || 0),
      };

      console.log('⚡ Processing ETH deposit...');
      await this.bridgeProcessor.processL1Deposit(depositEvent);

    } catch (error) {
      console.log('❌ Error processing ETH deposit:', error);
      logger.error('Error handling DepositETH event:', error);
    }
  }

  private async handleDepositERC20(depositId: bigint, user: string, token: string, amount: bigint, nonce: bigint, timestamp: bigint, event: ethers.EventLog): Promise<void> {
    try {
      console.log('\n🪙 NEW ERC20 DEPOSIT EVENT DETECTED!');
      console.log('=' .repeat(50));
      console.log(`💰 Deposit ID: ${depositId.toString()}`);
      console.log(`👤 User: ${user}`);
      console.log(`🏷️  Token: ${token}`);
      console.log(`💎 Amount: ${amount.toString()}`);
      console.log(`🔢 User Nonce: ${nonce.toString()}`);
      console.log('=' .repeat(50));
      
      logger.info('DepositERC20 event received:', {
        depositId: depositId.toString(),
        user,
        token,
        amount: amount.toString(),
        nonce: nonce.toString(),
      });

      const depositEvent: L1DepositEvent = {
        depositId,
        user,
        token,
        amount,
        nonce,
        timestamp,
        transactionHash: event.transactionHash || 'unknown',
        blockNumber: BigInt(event.blockNumber || 0),
      };

      console.log('⚡ Processing ERC20 deposit...');
      await this.bridgeProcessor.processL1Deposit(depositEvent);

    } catch (error) {
      console.log('❌ Error processing ERC20 deposit:', error);
      logger.error('Error handling DepositERC20 event:', error);
    }
  }

  private startHealthCheck(): void {
    setInterval(async () => {
      try {
        const blockNumber = await this.l1Provider.getBlockNumber();
        if (blockNumber > this.lastProcessedBlock) {
          this.lastProcessedBlock = blockNumber;
          console.log(`💗 Health Check - L1 Block: ${blockNumber} (${new Date().toLocaleTimeString()})`);
          logger.debug(`Health check passed. Current block: ${blockNumber}`);
        }
      } catch (error) {
        console.log('💔 Health check failed:', error);
        logger.error('Health check failed:', error);
      }
    }, 30000);
  }

  private async checkRecentEvents(currentBlock: number): Promise<void> {
    try {
      const fromBlock = Math.max(0, currentBlock - 1000);
      console.log(`🔎 Querying events from block ${fromBlock} to ${currentBlock}...`);
      
      const ethEvents = await this.l1Contract.queryFilter('DepositETH', fromBlock, currentBlock);
      console.log(`📊 Found ${ethEvents.length} DepositETH events in recent blocks`);
      
      const erc20Events = await this.l1Contract.queryFilter('DepositERC20', fromBlock, currentBlock);
      console.log(`📊 Found ${erc20Events.length} DepositERC20 events in recent blocks`);
      
      if (ethEvents.length > 0 || erc20Events.length > 0) {
        console.log('✅ Events found! Event listener should be working.');
      } else {
        console.log('ℹ️  No recent events found. Waiting for new transactions...');
      }
    } catch (error) {
      console.log('❌ Error checking recent events:', error);
    }
  }

  private handleProviderError(error: any): void {
    // Suppress filter not found errors as they're not critical and normal
    if (error.code === 'UNKNOWN_ERROR' && 
        error.error?.message?.includes('filter not found')) {
      logger.debug('Filter expired, this is normal RPC behavior - filters auto-expire');
      return;
    }
    
    // Log other provider errors
    logger.error('Provider error:', {
      code: error.code,
      message: error.message,
      error: error.error
    });
  }

  public getStatus() {
    return {
      isListening: this.isListening,
      lastProcessedBlock: this.lastProcessedBlock,
      provider: process.env.L1_RPC_URL || 'Unknown',
    };
  }
}

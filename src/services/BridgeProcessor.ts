import { ethers } from 'ethers';
import { getBridgeQueue } from '@/config/redis';
import { getDatabase } from '@/config/database';
import { logger } from '@/utils/logger';
import { L1DepositEvent, BridgeJob, BridgeStatus } from '@/types/bridge';

// ABI for L2 Bridge Contract (Library-based) - Transfer ownership hanya via MetaMask/wallet signing untuk keamanan
const BRIDGE_L2_ABI = [
  "function releaseERC20(uint256 layerOneId, address layerOneToken, address to, uint256 amount, string memory name, string memory symbol) external",
  "function releaseETH(address to, uint256 amount) external",
  "event ReleaseERC20(uint256 indexed layerOneId, address to, address token, uint256 amount, uint256 timestamp)",
  "event ReleaseETH(address indexed to, uint256 amount, uint256 timestamp)",
  "event OwnershipTransferred(address indexed previousAdmin, address indexed newAdmin)",
  "event TokenCreated(address indexed layerOneToken, string name, string symbol)"
];

// ABI for ERC20 tokens to get name and symbol
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

export class BridgeProcessor {
  private l2Provider: ethers.JsonRpcProvider;
  private l2Contract!: ethers.Contract; // Definite assignment assertion - initialized in constructor
  private bridgeSigner: ethers.Wallet;
  private queue: any;

  constructor() {
    // Initialize L2 provider
    const l2RpcUrl = process.env.L2_RPC_URL;
    if (!l2RpcUrl) {
      throw new Error('L2_RPC_URL not configured');
    }
    
    this.l2Provider = new ethers.JsonRpcProvider(l2RpcUrl);
    
    // Initialize bridge signer
    const bridgePrivateKey = process.env.BRIDGE_PRIVATE_KEY;
    if (!bridgePrivateKey) {
      throw new Error('BRIDGE_PRIVATE_KEY not configured');
    }
    
    this.bridgeSigner = new ethers.Wallet(bridgePrivateKey, this.l2Provider);
    
    // Initialize L2 contract
    const l2BridgeContract = process.env.L2_BRIDGE_CONTRACT;
    if (!l2BridgeContract) {
      throw new Error('L2_BRIDGE_CONTRACT not configured');
    }
    
    this.l2Contract = new ethers.Contract(
      l2BridgeContract,
      BRIDGE_L2_ABI,
      this.bridgeSigner
    );

    // Initialize queue processor
    this.initializeQueueProcessor();
  }

  async processL1Deposit(event: L1DepositEvent): Promise<void> {
    try {
      console.log('🔄 Processing L1 deposit for L2 release...');
      logger.info('Processing L1 deposit event:', {
        depositId: event.depositId.toString(),
        user: event.user,
        token: event.token,
        amount: event.amount.toString(),
      });

      // Create bridge job
      const bridgeJob: BridgeJob = {
        depositId: event.depositId.toString(),
        user: event.user,
        token: event.token,
        amount: event.amount.toString(),
        sourceChain: 'L1',
        targetChain: 'L2',
        txHash: event.transactionHash,
        blockNumber: event.blockNumber.toString(),
      };

      // Process release to L2 immediately
      await this.releaseToL2(event, bridgeJob);

      logger.info('L1 deposit event processed successfully');
    } catch (error) {
      console.log('❌ Error processing L1 deposit:', error);
      logger.error('Error processing L1 deposit event:', error);
      throw error;
    }
  }

  private async releaseToL2(event: L1DepositEvent, job: BridgeJob): Promise<void> {
    try {
      console.log(`🚀 Releasing to L2: ${job.token === ethers.ZeroAddress ? 'ETH' : 'ERC20'}`);
      
      if (job.token === ethers.ZeroAddress) {
        // Release ETH to L2
        await this.releaseETHToL2(event, job);
      } else {
        // Release ERC20 to L2
        await this.releaseERC20ToL2(event, job);
      }
      
      console.log('✅ L2 release completed successfully!');
      
    } catch (error) {
      console.log('❌ L2 release failed:', error);
      throw error;
    }
  }

  private async releaseETHToL2(event: L1DepositEvent, job: BridgeJob): Promise<void> {
    try {
      console.log(`💎 Releasing ${ethers.formatEther(event.amount)} ETH to ${job.user}`);
      
      if (!this.l2Contract) {
        throw new Error('L2 contract not initialized');
      }

      const tx = await (this.l2Contract as any).releaseETH(
        job.user,
        event.amount
      );
      
      console.log(`📤 ETH release transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ ETH release confirmed in block: ${receipt.blockNumber}`);
      console.log(`🌐 L2 Transaction: https://testnet-scan.dexgood.com/tx/${tx.hash}`);
      
      logger.info('ETH released to L2:', {
        user: job.user,
        amount: ethers.formatEther(event.amount),
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      });
      
    } catch (error) {
      logger.error('Error releasing ETH to L2:', error);
      throw error;
    }
  }

  private async releaseERC20ToL2(event: L1DepositEvent, job: BridgeJob): Promise<void> {
    try {
      console.log(`🪙 Releasing ERC20 token ${job.token} to ${job.user}`);
      
      // Get token info from L1
      const tokenInfo = await this.getTokenInfo(job.token);
      console.log(`📋 Token Info: ${tokenInfo.name} (${tokenInfo.symbol})`);
      
      if (!this.l2Contract) {
        throw new Error('L2 contract not initialized');
      }

      const tx = await (this.l2Contract as any).releaseERC20(
        event.depositId,
        job.token,
        job.user,
        event.amount,
        tokenInfo.name,
        tokenInfo.symbol
      );
      
      console.log(`📤 ERC20 release transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ ERC20 release confirmed in block: ${receipt.blockNumber}`);
      console.log(`🌐 L2 Transaction: https://testnet-scan.dexgood.com/tx/${tx.hash}`);
      
      logger.info('ERC20 released to L2:', {
        user: job.user,
        token: job.token,
        amount: event.amount.toString(),
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      });
      
    } catch (error) {
      logger.error('Error releasing ERC20 to L2:', error);
      throw error;
    }
  }

  private async getTokenInfo(tokenAddress: string): Promise<{name: string, symbol: string, decimals: number}> {
    try {
      console.log(`🔍 Getting token info for ${tokenAddress}`);
      // Create L1 provider to get token info
      const l1Provider = new ethers.JsonRpcProvider(process.env.L1_RPC_URL);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, l1Provider);

      const [name, symbol, decimals] = await Promise.all([
        (tokenContract as any).name(),
        (tokenContract as any).symbol(),
        (tokenContract as any).decimals()
      ]) as [string, string, number];
      
      return { name, symbol, decimals };
    } catch (error) {
      logger.warn('Could not get token info, using defaults:', error);
      return { 
        name: `Bridged Token ${tokenAddress.slice(0, 6)}`,
        symbol: `BT${tokenAddress.slice(-4)}`,
        decimals: 18 
      };
    }
  }

  private initializeQueueProcessor(): void {
    const queue = getBridgeQueue();
    
    queue.process('process-bridge', parseInt(process.env.QUEUE_CONCURRENCY || '5'), async (job: any) => {
      const bridgeJob: BridgeJob = job.data;
      return await this.processBridgeJob(bridgeJob);
    });
  }

  private async processBridgeJob(job: BridgeJob): Promise<any> {
    const db = getDatabase();
    
    try {
      logger.info(`Processing bridge job for deposit ${job.depositId}`);

      // Update status to processing
      await db.bridgeDeposit.update({
        where: { depositId: job.depositId },
        data: { 
          status: BridgeStatus.PROCESSING,
          updatedAt: new Date(),
        },
      });

      // Wait for sufficient confirmations
      await this.waitForConfirmations(job.txHash, job.blockNumber);

      // Validate the deposit
      await this.validateDeposit(job);

      // Execute release on L2 (already done in releaseToL2)
      // No additional mint needed since releaseERC20/releaseETH already handles token creation and minting

      // Update status to completed
      await db.bridgeDeposit.update({
        where: { depositId: job.depositId },
        data: {
          status: BridgeStatus.COMPLETED,
          completedTxHash: job.txHash, // Use original L1 tx hash for reference
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info(`Bridge job completed for deposit ${job.depositId}`, {
        originalTxHash: job.txHash,
      });

      return { success: true, txHash: job.txHash };

    } catch (error) {
      logger.error(`Bridge job failed for deposit ${job.depositId}:`, error);

      // Update retry count and status
      const currentDeposit = await db.bridgeDeposit.findUnique({
        where: { depositId: job.depositId }
      });

      const retryCount = (currentDeposit?.retryCount || 0) + 1;
      const maxRetries = parseInt(process.env.JOB_RETRY_ATTEMPTS || '3');

      await db.bridgeDeposit.update({
        where: { depositId: job.depositId },
        data: {
          status: retryCount >= maxRetries ? BridgeStatus.FAILED : BridgeStatus.PENDING,
          retryCount,
          failureReason: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        },
      });

      throw error;
    }
  }

  private async waitForConfirmations(txHash: string, blockNumber: string): Promise<void> {
    const requiredConfirmations = parseInt(process.env.CONFIRMATION_BLOCKS || '12');
    const l1Provider = new ethers.JsonRpcProvider(process.env.L1_RPC_URL!);
    
    while (true) {
      const currentBlock = await l1Provider.getBlockNumber();
      const confirmations = currentBlock - parseInt(blockNumber);
      
      if (confirmations >= requiredConfirmations) {
        logger.info(`Sufficient confirmations received: ${confirmations}/${requiredConfirmations}`);
        break;
      }
      
      logger.info(`Waiting for confirmations: ${confirmations}/${requiredConfirmations}`);
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    }
  }

  private async validateDeposit(job: BridgeJob): Promise<void> {
    // TODO: Add additional validation logic
    // - Verify transaction receipt
    // - Check if user has sufficient balance
    // - Validate token contract
    // - Check for any blacklisted addresses
    
    const minAmount = BigInt(ethers.parseEther(process.env.MIN_BRIDGE_AMOUNT || '0.001'));
    const maxAmount = BigInt(ethers.parseEther(process.env.MAX_BRIDGE_AMOUNT || '1000'));
    const amount = BigInt(job.amount);
    
    if (amount < minAmount) {
      throw new Error(`Amount ${ethers.formatEther(amount)} is below minimum ${ethers.formatEther(minAmount)}`);
    }
    
    if (amount > maxAmount) {
      throw new Error(`Amount ${ethers.formatEther(amount)} exceeds maximum ${ethers.formatEther(maxAmount)}`);
    }
    
    logger.info(`Deposit validation passed for ${job.depositId}`);
  }

  private calculateJobPriority(amount: bigint): number {
    // Higher amounts get higher priority (lower number = higher priority in Bull)
    const ethAmount = parseFloat(ethers.formatEther(amount));
    
    if (ethAmount >= 100) return 1;   // High priority
    if (ethAmount >= 10) return 5;    // Medium priority
    return 10;                        // Normal priority
  }

  public async getQueueStats(): Promise<any> {
    const queue = getBridgeQueue();
    
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }


}
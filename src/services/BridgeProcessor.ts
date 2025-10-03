import { ethers } from 'ethers';
import { getBridgeQueue } from '@/config/redis';
import { getDatabase } from '@/config/database';
import { logger } from '@/utils/logger';
import { L1DepositEvent, BridgeJob, BridgeStatus } from '@/types/bridge';

// ABI for L2 Bridge Contract
const BRIDGE_L2_ABI = [
  "function mintToken(address to, address token, uint256 amount, uint256 depositId) external",
  "function mintETH(address to, uint256 amount, uint256 depositId) external payable",
];

export class BridgeProcessor {
  private l2Provider: ethers.JsonRpcProvider;
  private l2Contract: ethers.Contract;
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

  async processL1Deposit(depositEvent: L1DepositEvent): Promise<void> {
    try {
      const db = getDatabase();
      
      // Check if deposit already exists
      const existingDeposit = await db.bridgeDeposit.findUnique({
        where: { depositId: depositEvent.depositId.toString() }
      });

      if (existingDeposit) {
        logger.warn(`Deposit ${depositEvent.depositId} already exists, skipping`);
        return;
      }

      // Create bridge deposit record
      const bridgeDeposit = await db.bridgeDeposit.create({
        data: {
          depositId: depositEvent.depositId.toString(),
          user: depositEvent.user.toLowerCase(),
          token: depositEvent.token.toLowerCase(),
          amount: depositEvent.amount.toString(),
          sourceChain: 'L1',
          targetChain: 'L2',
          status: BridgeStatus.PENDING,
          txHash: depositEvent.transactionHash,
          blockNumber: depositEvent.blockNumber.toString(),
          timestamp: new Date(Number(depositEvent.timestamp) * 1000),
          retryCount: 0,
        },
      });

      logger.info('Bridge deposit created:', {
        id: bridgeDeposit.id,
        depositId: bridgeDeposit.depositId,
        user: bridgeDeposit.user,
        amount: bridgeDeposit.amount,
      });

      // Add job to queue for processing
      const job: BridgeJob = {
        depositId: bridgeDeposit.depositId,
        user: bridgeDeposit.user,
        token: bridgeDeposit.token,
        amount: bridgeDeposit.amount,
        sourceChain: 'L1',
        targetChain: 'L2',
        txHash: bridgeDeposit.txHash,
        blockNumber: bridgeDeposit.blockNumber,
      };

      const queue = getBridgeQueue();
      await queue.add('process-bridge', job, {
        delay: 5000, // Wait 5 seconds before processing
        priority: this.calculateJobPriority(BigInt(job.amount)),
      });

      logger.info(`Bridge job queued for deposit ${depositEvent.depositId}`);

    } catch (error) {
      logger.error('Error processing L1 deposit:', error);
      throw error;
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

      // Execute mint on L2
      const mintTxHash = await this.executeMintOnL2(job);

      // Update status to completed
      await db.bridgeDeposit.update({
        where: { depositId: job.depositId },
        data: {
          status: BridgeStatus.COMPLETED,
          completedTxHash: mintTxHash,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      logger.info(`Bridge job completed for deposit ${job.depositId}`, {
        mintTxHash,
      });

      return { success: true, mintTxHash };

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

  private async executeMintOnL2(job: BridgeJob): Promise<string> {
    try {
      const amount = BigInt(job.amount);
      const isETH = job.token === ethers.ZeroAddress;
      
      let transaction;
      
      if (isETH) {
        // Mint ETH
        transaction = await this.l2Contract.mintETH(
          job.user,
          amount,
          BigInt(job.depositId),
          {
            gasLimit: BigInt(process.env.GAS_LIMIT || '300000'),
            maxFeePerGas: BigInt(ethers.parseUnits('20', 'gwei')),
            maxPriorityFeePerGas: BigInt(ethers.parseUnits('2', 'gwei')),
          }
        );
      } else {
        // Mint ERC20 token
        transaction = await this.l2Contract.mintToken(
          job.user,
          job.token,
          amount,
          BigInt(job.depositId),
          {
            gasLimit: BigInt(process.env.GAS_LIMIT || '300000'),
            maxFeePerGas: BigInt(ethers.parseUnits('20', 'gwei')),
            maxPriorityFeePerGas: BigInt(ethers.parseUnits('2', 'gwei')),
          }
        );
      }

      logger.info(`Mint transaction sent for deposit ${job.depositId}:`, {
        txHash: transaction.hash,
        gasLimit: transaction.gasLimit?.toString(),
      });

      // Wait for transaction confirmation
      const receipt = await transaction.wait();
      
      if (receipt?.status !== 1) {
        throw new Error(`Transaction failed: ${transaction.hash}`);
      }

      logger.info(`Mint transaction confirmed for deposit ${job.depositId}:`, {
        txHash: transaction.hash,
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber,
      });

      return transaction.hash;

    } catch (error) {
      logger.error(`Failed to execute mint on L2 for deposit ${job.depositId}:`, error);
      throw error;
    }
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
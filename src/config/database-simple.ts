import pg from 'pg';
import { logger } from '@/utils/logger';

const { Pool } = pg;

let pool: pg.Pool;

export async function initializeDatabaseSimple(): Promise<pg.Pool> {
  try {
    // Create connection pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    
    // Create tables if they don't exist
    await createTablesIfNotExists(client);
    
    client.release();
    
    logger.info('Simple database connection established successfully');
    return pool;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

async function createTablesIfNotExists(client: pg.PoolClient): Promise<void> {
  const createBridgeDepositTable = `
    CREATE TABLE IF NOT EXISTS bridge_deposits (
      id SERIAL PRIMARY KEY,
      deposit_id VARCHAR(255) UNIQUE NOT NULL,
      user_address VARCHAR(42) NOT NULL,
      token_address VARCHAR(42) NOT NULL,
      amount VARCHAR(255) NOT NULL,
      nonce VARCHAR(255),
      source_chain VARCHAR(10) DEFAULT 'L1',
      target_chain VARCHAR(10) DEFAULT 'L2',
      status VARCHAR(20) DEFAULT 'PENDING',
      tx_hash VARCHAR(66),
      block_number VARCHAR(255),
      retry_count INTEGER DEFAULT 0,
      failure_reason TEXT,
      completed_tx_hash VARCHAR(66),
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_bridge_deposits_user ON bridge_deposits(user_address);
    CREATE INDEX IF NOT EXISTS idx_bridge_deposits_status ON bridge_deposits(status);
    CREATE INDEX IF NOT EXISTS idx_bridge_deposits_deposit_id ON bridge_deposits(deposit_id);
    CREATE INDEX IF NOT EXISTS idx_bridge_deposits_created_at ON bridge_deposits(created_at);
  `;

  await client.query(createBridgeDepositTable);
  await client.query(createIndexes);
  
  logger.info('Database tables created/verified successfully');
}

export function getDatabaseSimple(): pg.Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabaseSimple() first.');
  }
  return pool;
}

export async function closeDatabaseSimple(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
}

// Helper functions for bridge operations
export class SimpleBridgeDB {
  static async saveBridgeDeposit(deposit: {
    depositId: string;
    userAddress: string;
    tokenAddress: string;
    amount: string;
    nonce?: string;
    txHash: string;
    blockNumber: string;
    timestamp: Date;
  }): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO bridge_deposits (
          deposit_id, user_address, token_address, amount, nonce,
          tx_hash, block_number, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (deposit_id) DO NOTHING
      `;
      
      await client.query(query, [
        deposit.depositId,
        deposit.userAddress.toLowerCase(),
        deposit.tokenAddress.toLowerCase(),
        deposit.amount,
        deposit.nonce || null,
        deposit.txHash,
        deposit.blockNumber,
        deposit.timestamp
      ]);
      
      logger.info(`Deposit saved to database: ${deposit.depositId}`);
    } catch (error) {
      logger.error('Error saving deposit to database:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateDepositStatus(
    depositId: string, 
    status: string, 
    completedTxHash?: string,
    failureReason?: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE bridge_deposits 
        SET status = $1, 
            completed_tx_hash = $2,
            completed_at = CASE WHEN $1 = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END,
            failure_reason = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE deposit_id = $4
      `;
      
      await client.query(query, [status, completedTxHash, failureReason, depositId]);
      logger.info(`Deposit ${depositId} status updated to ${status}`);
    } catch (error) {
      logger.error('Error updating deposit status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getDepositByTxHash(txHash: string): Promise<any> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM bridge_deposits WHERE tx_hash = $1';
      const result = await client.query(query, [txHash]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting deposit by tx hash:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
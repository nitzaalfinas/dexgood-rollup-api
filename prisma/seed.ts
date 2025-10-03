import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create sample supported tokens
  const tokens = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      l1Address: '0xA0b86a33E6C6b2Fbe8cf3F09De80B2F07a26f7a5',
      l2Address: '0xB0c86a33E6C6b2Fbe8cf3F09De80B2F07a26f7a6',
      isActive: true,
      minBridgeAmount: '1000000', // 1 USDC
      maxBridgeAmount: '100000000000', // 100,000 USDC
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      decimals: 18,
      l1Address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      l2Address: '0xgGg9976782d46CC05630D1f6eBAb18b2324d6B15',
      isActive: true,
      minBridgeAmount: '10000000000000000', // 0.01 WETH
      maxBridgeAmount: '100000000000000000000', // 100 WETH
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      l1Address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
      l2Address: '0x8269D38820dfd117C3FA1f22a697dBA58d90BA07',
      isActive: true,
      minBridgeAmount: '1000000', // 1 USDT
      maxBridgeAmount: '50000000000', // 50,000 USDT
    },
  ];

  console.log('Creating supported tokens...');
  for (const token of tokens) {
    await prisma.supportedToken.upsert({
      where: { symbol: token.symbol },
      update: token,
      create: token,
    });
    console.log(`✅ Created/updated token: ${token.symbol}`);
  }

  // Create sample API keys for testing
  const apiKeys = [
    {
      name: 'Development Key',
      key: 'dev_key_12345',
      hashedKey: '$2b$10$rV3K8Y7gF4nH2sL9mQ6xOeJhEcGf5vW8zA1bC2dE3fG4hI5jK6lM7', // hashed version of 'dev_key_12345'
      permissions: ['bridge:read', 'bridge:write', 'admin:read'],
      isActive: true,
      rateLimit: 1000,
      description: 'Development and testing purposes',
    },
    {
      name: 'Frontend Integration',
      key: 'frontend_key_67890',
      hashedKey: '$2b$10$sW4L9Z8hG5oI3tM0nR7yPfKiFdHg6wX9aB2cD3eF4gH5iJ6kL7mN8', // hashed version of 'frontend_key_67890'
      permissions: ['bridge:read', 'bridge:write'],
      isActive: true,
      rateLimit: 500,
      description: 'Frontend application access',
    },
  ];

  console.log('Creating API keys...');
  for (const apiKey of apiKeys) {
    await prisma.aPIKey.upsert({
      where: { key: apiKey.key },
      update: apiKey,
      create: apiKey,
    });
    console.log(`✅ Created/updated API key: ${apiKey.name}`);
  }

  // Create sample bridge configuration
  const bridgeConfig = {
    l1ChainId: 11155111, // Sepolia
    l2ChainId: 443, // GoodNet Testnet
    l1RpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    l2RpcUrl: 'https://testnet-scan.dexgood.com/rpc',
    l1BridgeContract: '0x1234567890123456789012345678901234567890',
    l2BridgeContract: '0x1234567890123456789012345678901234567890',
    minConfirmations: 12,
    maxGasPrice: '50000000000', // 50 gwei
    bridgeFee: '1000000000000000', // 0.001 ETH
    isActive: true,
    maintenanceMode: false,
  };

  console.log('Creating bridge configuration...');
  await prisma.bridgeConfig.upsert({
    where: { l1ChainId_l2ChainId: { l1ChainId: bridgeConfig.l1ChainId, l2ChainId: bridgeConfig.l2ChainId } },
    update: bridgeConfig,
    create: bridgeConfig,
  });
  console.log('✅ Created/updated bridge configuration');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
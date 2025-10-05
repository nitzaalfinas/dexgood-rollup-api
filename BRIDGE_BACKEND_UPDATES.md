# Bridge Backend Updates - Smart Contract Integration

## 📋 Update Summary

Backend telah diperbarui untuk menyesuaikan dengan perubahan smart contract L1 dan L2 yang baru, khususnya untuk area **user deposit ERC20 di L1 dan penerbitan token wrapped pada L2** dengan penambahan **userNonce system**.

## 🔄 Perubahan Utama

### 1. Event Listener Updates (`BridgeEventListener.ts`)

#### ✅ Updated L1 Bridge ABI
```typescript
const BRIDGE_L1_ABI = [
  // OLD: "event DepositERC20(uint256 indexed depositId, address indexed user, address indexed token, uint256 amount, uint256 timestamp)",
  // NEW: Menambahkan nonce parameter
  "event DepositERC20(uint256 indexed depositId, address indexed user, address indexed token, uint256 amount, uint256 nonce, uint256 timestamp)",
  "event DepositETH(uint256 indexed depositId, address indexed user, uint256 amount, uint256 nonce, uint256 timestamp)",
  "event OwnershipTransferred(address indexed previousAdmin, address indexed newAdmin)",
];
```

#### ✅ Updated Event Handler Method Signatures
```typescript
// ETH Deposit Handler - Menambahkan nonce parameter
private async handleDepositETH(
  depositId: bigint, 
  user: string, 
  amount: bigint, 
  nonce: bigint,    // 🆕 NEW PARAMETER
  timestamp: bigint, 
  event: ethers.EventLog
): Promise<void>

// ERC20 Deposit Handler - Menambahkan nonce parameter
private async handleDepositERC20(
  depositId: bigint, 
  user: string, 
  token: string, 
  amount: bigint, 
  nonce: bigint,     // 🆕 NEW PARAMETER
  timestamp: bigint, 
  event: ethers.EventLog
): Promise<void>
```

#### ✅ Enhanced Logging
- Menampilkan user nonce dalam console logging
- Logging lebih informatif dengan nonce tracking

### 2. Bridge Processor Updates (`BridgeProcessor.ts`)

#### ✅ Updated L2 Bridge ABI 
```typescript
const BRIDGE_L2_ABI = [
  // OLD: "function releaseERC20(...) external",
  // NEW: Menggunakan depositERC20/depositETH functions
  "function depositERC20(uint256 l1DepositId, address l1Token, address to, uint256 amount, string memory name, string memory symbol) external",
  "function depositETH(uint256 l1DepositId, address to, uint256 amount) external",
  "event DepositERC20(uint256 indexed depositId, uint256 indexed l1DepositId, address indexed to, address l1Token, address l2Token, uint256 amount, uint256 timestamp)",
  "event DepositETH(uint256 indexed depositId, address indexed to, uint256 amount, uint256 timestamp)",
  "event TokenCreated(address indexed l1Token, address indexed l2Token, string name, string symbol)",
];
```

#### ✅ Updated Contract Function Calls
```typescript
// ETH Processing - Updated function name
const tx = await (this.l2Contract as any).depositETH(
  event.depositId,  // Menggunakan L1 deposit ID
  job.user,
  event.amount
);

// ERC20 Processing - Updated function name  
const tx = await (this.l2Contract as any).depositERC20(
  event.depositId,  // Menggunakan L1 deposit ID
  job.token,
  job.user,
  event.amount,
  tokenInfo.name,
  tokenInfo.symbol
);
```

#### ✅ Database Integration
- Menambahkan `saveBridgeDeposit()` method untuk menyimpan deposit ke database
- Nonce tracking dan logging yang lebih baik
- Duplicate entry handling

### 3. Type System Updates (`bridge.ts`)

#### ✅ Updated L1DepositEvent Interface
```typescript
export interface L1DepositEvent {
  depositId: bigint;
  user: string;
  token: string;
  amount: bigint;
  nonce: bigint;      // 🆕 NEW FIELD
  timestamp: bigint;
  transactionHash: string;
  blockNumber: bigint;
}
```

### 4. Database Schema Updates (`schema.prisma`)

#### ✅ Updated BridgeDeposit Model
```prisma
model BridgeDeposit {
  id              String       @id @default(cuid())
  depositId       String       @unique
  user            String
  token           String
  amount          String
  nonce           String?      // 🆕 NEW FIELD - User nonce for enhanced security
  sourceChain     ChainType
  targetChain     ChainType
  status          BridgeStatus @default(PENDING)
  // ... other fields
}
```

### 5. API Controller Updates (`bridgeController.ts`)

#### ✅ Enhanced Token Configuration
```typescript
const supportedTokens = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    // ... other fields
    hasNonce: true,  // 🆕 Menunjukkan dukungan nonce system
  },
  {
    symbol: 'USDT',
    l1Address: '0x7169D38820dfd117C3FA1f22a697dba58d90BA06', // Real Sepolia address
    hasNonce: true,
  },
  // ... other tokens
];
```

## 🎯 Flow Process Baru

### User Deposit ERC20 di L1 → Token Wrapped di L2

1. **L1 Event Detection**
   ```
   User calls depositERC20(token, amount) on L1
   ↓
   DepositERC20 event emitted dengan nonce
   ↓ 
   BridgeEventListener menangkap event
   ```

2. **Backend Processing**
   ```
   handleDepositERC20(depositId, user, token, amount, nonce, timestamp)
   ↓
   Save to database dengan nonce
   ↓
   Create BridgeJob
   ```

3. **L2 Token Minting**
   ```
   processL1Deposit()
   ↓
   releaseERC20ToL2() → calls depositERC20() on L2
   ↓
   L2 contract mints wrapped token atau create new token
   ```

## 🔒 Security Enhancements

1. **Nonce System**: Mencegah replay attacks dan front-running
2. **Enhanced Logging**: Tracking nonce untuk audit trail yang lebih baik
3. **Database Integrity**: Nonce disimpan untuk reference dan debugging
4. **Duplicate Prevention**: Graceful handling duplicate deposit IDs

## 🚀 Status

✅ **COMPLETED** - Phase 1: User deposit ERC20 di L1 → Token wrapped di L2
- Event listeners updated dengan nonce support
- Contract function calls updated  
- Database schema updated
- API endpoints enhanced
- Type system updated

## 📋 Next Steps

1. **Database Migration**: Run Prisma migration untuk field nonce baru
2. **Testing**: Test end-to-end flow dengan nonce system
3. **Phase 2**: User withdraw dari L2 → Release tokens di L1
4. **Frontend Updates**: Update frontend untuk display nonce information

## 🛠 Commands untuk Deploy

```bash
# Generate Prisma client (sudah dilakukan)
npx prisma generate

# Create and run migration (belum dilakukan)
npx prisma migrate dev --name add-nonce-field

# Test compilation
npm run build
```
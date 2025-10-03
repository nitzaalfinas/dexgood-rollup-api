import { validateAddress, validateAmount, validateChainId } from '../src/utils/validation';

describe('Validation Utils', () => {
  describe('validateAddress', () => {
    it('should return true for valid Ethereum address', () => {
      expect(validateAddress('0x742d35Cc6634C0532925a3b8D1eC8Fbedc5b0dc7')).toBe(true);
    });

    it('should return false for invalid address', () => {
      expect(validateAddress('0x123')).toBe(false);
      expect(validateAddress('invalid-address')).toBe(false);
      expect(validateAddress('')).toBe(false);
    });
  });

  describe('validateAmount', () => {
    it('should return true for valid amount', () => {
      expect(validateAmount('1000000000000000000')).toBe(true);
      expect(validateAmount('1')).toBe(true);
    });

    it('should return false for invalid amount', () => {
      expect(validateAmount('0')).toBe(false);
      expect(validateAmount('-1')).toBe(false);
      expect(validateAmount('abc')).toBe(false);
      expect(validateAmount('')).toBe(false);
    });
  });

  describe('validateChainId', () => {
    it('should return true for supported chain IDs', () => {
      expect(validateChainId(11155111)).toBe(true); // Sepolia
      expect(validateChainId(443)).toBe(true); // GoodNet Testnet
    });

    it('should return false for unsupported chain IDs', () => {
      expect(validateChainId(1)).toBe(false); // Mainnet
      expect(validateChainId(999999)).toBe(false); // Random
    });
  });
});
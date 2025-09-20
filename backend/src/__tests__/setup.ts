import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/safedocs_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.FILECOIN_TOKEN = 'test-filecoin-token';
process.env.LIGHTHOUSE_API_KEY = 'test-lighthouse-key';

// Mock external dependencies
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../utils/database', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    signature: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    storageProof: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    verificationResult: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    complianceReport: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

// Mock Filecoin/IPFS services
jest.mock('../services/filecoinStorage', () => ({
  filecoinStorage: {
    storeDocument: jest.fn(),
    retrieveDocument: jest.fn(),
    verifyDocumentIntegrity: jest.fn(),
    generateStorageProof: jest.fn(),
    calculateStorageCost: jest.fn(),
    encryptDocument: jest.fn(),
    decryptDocument: jest.fn(),
  },
}));

jest.mock('../services/filCDNService', () => ({
  filCDNService: {
    retrieveDocument: jest.fn(),
    prewarmCache: jest.fn(),
    invalidateCache: jest.fn(),
    getCDNAnalytics: jest.fn(),
    getOptimalNode: jest.fn(),
  },
}));

// Mock authentication services
jest.mock('../services/synapseAuthService', () => ({
  synapseAuthService: {
    generateSIWEMessage: jest.fn(),
    verifySIWESignature: jest.fn(),
    generateJWT: jest.fn(),
    verifyJWT: jest.fn(),
    refreshToken: jest.fn(),
  },
}));

jest.mock('../services/digitalSigningService', () => ({
  digitalSigningService: {
    signDocument: jest.fn(),
    verifySignature: jest.fn(),
    batchVerifySignatures: jest.fn(),
    initiateSigningSession: jest.fn(),
    completeSigningSession: jest.fn(),
  },
}));

// Mock ethers for crypto operations
jest.mock('ethers', () => ({
  ethers: {
    verifyMessage: jest.fn(),
    getAddress: jest.fn(),
    isAddress: jest.fn(),
    utils: {
      verifyMessage: jest.fn(),
      getAddress: jest.fn(),
      isAddress: jest.fn(),
    },
  },
}));

// Global test utilities
declare global {
  var createMockUser: () => any;
  var createMockDocument: () => any;
  var createMockSignature: () => any;
  var createMockStorageProof: () => any;
}

(global as any).createMockUser = () => ({
  id: 'test-user-id',
  walletAddress: '0x1234567890123456789012345678901234567890',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'USER',
  isEmailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

(global as any).createMockDocument = () => ({
  id: 'test-document-id',
  title: 'Test Document',
  description: 'Test document description',
  originalFileName: 'test.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024,
  documentHash: 'test-hash-123',
  encryptedData: 'encrypted-key-data',
  ipfsCid: 'QmTestCid123',
  filecoinDealId: 'deal-123',
  uploadedBy: 'test-user-id',
  status: 'UPLOADED',
  isEncrypted: true,
  retentionPeriod: 365,
  complianceLevel: 'STANDARD',
  createdAt: new Date(),
  updatedAt: new Date(),
});

(global as any).createMockSignature = () => ({
  id: 'test-signature-id',
  documentId: 'test-document-id',
  signerId: 'test-signer-id',
  signerWalletAddress: '0x1234567890123456789012345678901234567890',
  signerName: 'Test Signer',
  signerEmail: 'signer@example.com',
  signatureData: 'signature-data-123',
  signatureAlgorithm: 'ECDSA',
  timestampSigned: new Date(),
  ipLocation: '127.0.0.1',
  deviceInfo: 'Test Device',
  isVerified: true,
  verificationProof: 'verification-proof-123',
  blockchainTxHash: 'tx-hash-123',
  createdAt: new Date(),
});

(global as any).createMockStorageProof = () => ({
  id: 'test-proof-id',
  documentId: 'test-document-id',
  proofType: 'PDP',
  proofData: JSON.stringify({
    hash: 'proof-hash-123',
    challenge: 'challenge-123',
    response: 'response-123',
    timestamp: new Date().toISOString(),
  }),
  blockchainTxHash: 'tx-hash-123',
  storageProvider: 'Filecoin',
  isValid: true,
  verificationCount: 1,
  lastVerified: new Date(),
  createdAt: new Date(),
});

// Set up test timeouts
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Export jest for TypeScript
export { jest };
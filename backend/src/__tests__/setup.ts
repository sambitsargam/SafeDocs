// Test setup and global configurations

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/safedocs_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters-long';
process.env.LIGHTHOUSE_API_KEY = 'test-lighthouse-key';
process.env.WEB3_STORAGE_TOKEN = 'test-web3-storage-token';

// Global test timeout
jest.setTimeout(30000);

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    document: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    signature: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    verificationResult: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    complianceReport: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  })),
}));

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  })),
}));

// Mock Filecoin/IPFS services
jest.mock('@lighthouse-web3/sdk', () => ({
  upload: jest.fn(),
  getBalance: jest.fn(),
  dealStatus: jest.fn(),
}));

jest.mock('@web3-storage/w3up-client', () => ({
  create: jest.fn(() => ({
    uploadFile: jest.fn(),
    uploadDirectory: jest.fn(),
  })),
}));

// Mock crypto operations
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('test-random-bytes')),
  createHash: jest.fn(() => ({
    update: jest.fn(),
    digest: jest.fn(() => 'test-hash'),
  })),
  createCipher: jest.fn(() => ({
    update: jest.fn(),
    final: jest.fn(),
  })),
  createDecipher: jest.fn(() => ({
    update: jest.fn(),
    final: jest.fn(),
  })),
}));

// Mock ethers for blockchain operations
jest.mock('ethers', () => ({
  Wallet: jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    signMessage: jest.fn(() => Promise.resolve('test-signature')),
  })),
  providers: {
    JsonRpcProvider: jest.fn(),
  },
  utils: {
    verifyMessage: jest.fn(() => '0x1234567890123456789012345678901234567890'),
    hashMessage: jest.fn(() => 'test-message-hash'),
  },
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(), // Add the missing 'add' method
  })),
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export {};
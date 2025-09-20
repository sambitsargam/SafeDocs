// API Constants
export const API_ENDPOINTS = {
  DOCUMENTS: '/api/documents',
  SIGNATURES: '/api/signatures',
  USERS: '/api/users',
  AUTH: '/api/auth',
  STORAGE: '/api/storage',
  VERIFICATION: '/api/verification',
  AUDIT: '/api/audit',
} as const;

// GraphQL Operations
export const GRAPHQL_OPERATIONS = {
  UPLOAD_DOCUMENT: 'uploadDocument',
  SIGN_DOCUMENT: 'signDocument',
  VERIFY_SIGNATURE: 'verifySignature',
  GET_DOCUMENT: 'getDocument',
  LIST_DOCUMENTS: 'listDocuments',
  CREATE_USER: 'createUser',
  AUTHENTICATE: 'authenticate',
} as const;

// File Constants
export const FILE_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
  ],
  UPLOAD_TIMEOUT: 30000, // 30 seconds
} as const;

// Filecoin Constants
export const FILECOIN_CONSTANTS = {
  MAINNET_CHAIN_ID: 314,
  TESTNET_CHAIN_ID: 314159,
  EPOCH_DURATION: 30, // seconds
  SECTORS_PER_EPOCH: 2880,
  MIN_DEAL_DURATION: 180, // days
  MAX_DEAL_DURATION: 540, // days
  DEFAULT_REPLICATION_FACTOR: 3,
} as const;

// Cryptography Constants
export const CRYPTO_CONSTANTS = {
  AES_KEY_SIZE: 256,
  RSA_KEY_SIZE: 2048,
  HASH_ITERATIONS: 10000,
  SALT_LENGTH: 32,
  IV_LENGTH: 16,
  DEFAULT_ENCRYPTION_ALGORITHM: 'AES-256-GCM',
  DEFAULT_HASH_ALGORITHM: 'SHA256',
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  INSUFFICIENT_PERMISSIONS: 'AUTH_003',
  WALLET_NOT_CONNECTED: 'AUTH_004',
  
  // Document
  DOCUMENT_NOT_FOUND: 'DOC_001',
  INVALID_DOCUMENT_FORMAT: 'DOC_002',
  DOCUMENT_TOO_LARGE: 'DOC_003',
  DOCUMENT_UPLOAD_FAILED: 'DOC_004',
  DOCUMENT_ALREADY_SIGNED: 'DOC_005',
  
  // Storage
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_001',
  FILECOIN_DEAL_FAILED: 'STORAGE_002',
  IPFS_UPLOAD_FAILED: 'STORAGE_003',
  RETRIEVAL_FAILED: 'STORAGE_004',
  
  // Signature
  INVALID_SIGNATURE: 'SIG_001',
  SIGNATURE_VERIFICATION_FAILED: 'SIG_002',
  SIGNATURE_EXPIRED: 'SIG_003',
  SIGNER_NOT_AUTHORIZED: 'SIG_004',
  
  // Compliance
  COMPLIANCE_VIOLATION: 'COMP_001',
  AUDIT_LOG_CORRUPTION: 'COMP_002',
  RETENTION_POLICY_VIOLATION: 'COMP_003',
  
  // System
  INTERNAL_SERVER_ERROR: 'SYS_001',
  SERVICE_UNAVAILABLE: 'SYS_002',
  RATE_LIMIT_EXCEEDED: 'SYS_003',
  VALIDATION_ERROR: 'SYS_004',
} as const;

// Status Messages
export const STATUS_MESSAGES = {
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid wallet address or signature',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Authentication token has expired',
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions for this action',
  [ERROR_CODES.WALLET_NOT_CONNECTED]: 'Wallet not connected',
  [ERROR_CODES.DOCUMENT_NOT_FOUND]: 'Document not found',
  [ERROR_CODES.INVALID_DOCUMENT_FORMAT]: 'Invalid document format',
  [ERROR_CODES.DOCUMENT_TOO_LARGE]: 'Document exceeds maximum file size',
  [ERROR_CODES.DOCUMENT_UPLOAD_FAILED]: 'Document upload failed',
  [ERROR_CODES.DOCUMENT_ALREADY_SIGNED]: 'Document has already been signed',
  [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded',
  [ERROR_CODES.FILECOIN_DEAL_FAILED]: 'Failed to create Filecoin storage deal',
  [ERROR_CODES.IPFS_UPLOAD_FAILED]: 'Failed to upload to IPFS',
  [ERROR_CODES.RETRIEVAL_FAILED]: 'Failed to retrieve document',
  [ERROR_CODES.INVALID_SIGNATURE]: 'Invalid digital signature',
  [ERROR_CODES.SIGNATURE_VERIFICATION_FAILED]: 'Signature verification failed',
  [ERROR_CODES.SIGNATURE_EXPIRED]: 'Signature has expired',
  [ERROR_CODES.SIGNER_NOT_AUTHORIZED]: 'Signer not authorized for this document',
  [ERROR_CODES.COMPLIANCE_VIOLATION]: 'Action violates compliance requirements',
  [ERROR_CODES.AUDIT_LOG_CORRUPTION]: 'Audit log integrity check failed',
  [ERROR_CODES.RETENTION_POLICY_VIOLATION]: 'Action violates data retention policy',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ERROR_CODES.VALIDATION_ERROR]: 'Validation error',
} as const;

// Compliance Constants
export const COMPLIANCE_CONSTANTS = {
  HIPAA: {
    MIN_PASSWORD_LENGTH: 8,
    SESSION_TIMEOUT: 15 * 60 * 1000, // 15 minutes
    AUDIT_RETENTION_YEARS: 6,
    ENCRYPTION_REQUIRED: true,
  },
  SOX: {
    AUDIT_RETENTION_YEARS: 7,
    DIGITAL_SIGNATURE_REQUIRED: true,
    IMMUTABLE_STORAGE: true,
    ACCESS_CONTROLS_REQUIRED: true,
  },
  GDPR: {
    CONSENT_REQUIRED: true,
    RIGHT_TO_ERASURE: true,
    DATA_PORTABILITY: true,
    BREACH_NOTIFICATION_HOURS: 72,
  },
} as const;

// Network Constants
export const NETWORK_CONSTANTS = {
  REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
} as const;

// Cache Constants
export const CACHE_CONSTANTS = {
  DEFAULT_TTL: 60 * 60, // 1 hour
  DOCUMENT_CACHE_TTL: 24 * 60 * 60, // 24 hours
  USER_CACHE_TTL: 30 * 60, // 30 minutes
  SIGNATURE_CACHE_TTL: 7 * 24 * 60 * 60, // 7 days
  PROOF_CACHE_TTL: 30 * 24 * 60 * 60, // 30 days
} as const;

// UI Constants
export const UI_CONSTANTS = {
  NOTIFICATION_TIMEOUT: 5000, // 5 seconds
  TOAST_TIMEOUT: 3000, // 3 seconds
  LOADING_TIMEOUT: 30000, // 30 seconds
  PAGINATION_DEFAULT_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 100,
} as const;

// Environment Variables
export const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  DATABASE_URL: 'DATABASE_URL',
  JWT_SECRET: 'JWT_SECRET',
  FILECOIN_PRIVATE_KEY: 'FILECOIN_PRIVATE_KEY',
  SYNAPSE_API_KEY: 'SYNAPSE_API_KEY',
  REDIS_URL: 'REDIS_URL',
  ENCRYPTION_KEY: 'ENCRYPTION_KEY',
} as const;

// Regular Expressions
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  WALLET_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  IPFS_CID: /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/,
  HASH_SHA256: /^[a-fA-F0-9]{64}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;
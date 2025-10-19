export interface User {
  id: string;
  walletAddress: string;
  email?: string;
  displayName?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  role: UserRole;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  ENTERPRISE = 'ENTERPRISE'
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  documentHash: string;
  encryptedData: string;
  ipfsCid: string;
  filecoinDealId?: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: DocumentStatus;
  isEncrypted: boolean;
  retentionPeriod?: number;
  complianceLevel: ComplianceLevel;
}

export enum DocumentStatus {
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  SIGNED = 'SIGNED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED'
}

export enum ComplianceLevel {
  STANDARD = 'STANDARD',
  HIPAA = 'HIPAA',
  SOX = 'SOX',
  GDPR = 'GDPR',
  HIGH_SECURITY = 'HIGH_SECURITY'
}

export interface Signature {
  id: string;
  documentId: string;
  signerId: string;
  signerWalletAddress: string;
  signerName: string;
  signerEmail?: string;
  signatureData: string;
  signatureAlgorithm: SignatureAlgorithm;
  signatureMetadata: SignatureMetadata;
  timestampSigned: Date;
  ipLocation?: string;
  deviceInfo?: string;
  isVerified: boolean;
  verificationProof?: string;
  blockchainTxHash?: string;
}

export enum SignatureAlgorithm {
  ECDSA = 'ECDSA',
  RSA = 'RSA',
  ED25519 = 'ED25519'
}

export interface SignatureMetadata {
  documentVersion: string;
  documentHash: string;
  signingMethod: SigningMethod;
  certificateFingerprint?: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
  };
}

export enum SigningMethod {
  WALLET_SIGNATURE = 'WALLET_SIGNATURE',
  CERTIFICATE_BASED = 'CERTIFICATE_BASED',
  BIOMETRIC = 'BIOMETRIC'
}

export interface StorageProof {
  id: string;
  documentId: string;
  proofType: ProofType;
  proofData: string;
  blockchainTxHash: string;
  storageProvider: string;
  createdAt: Date;
  expiresAt?: Date;
  isValid: boolean;
  verificationCount: number;
  lastVerifiedAt?: Date;
}

export enum ProofType {
  PDP = 'PDP',  // Proof of Data Possession
  POR = 'POR',  // Proof of Retrievability
  POW = 'POW',  // Proof of Work
  POS = 'POS'   // Proof of Storage
}

export interface AuditLog {
  id: string;
  userId?: string;
  documentId?: string;
  action: AuditAction;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  complianceLevel: ComplianceLevel;
  retentionDate: Date;
}

export enum AuditAction {
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_VIEWED = 'DOCUMENT_VIEWED',
  DOCUMENT_DOWNLOADED = 'DOCUMENT_DOWNLOADED',
  DOCUMENT_SIGNED = 'DOCUMENT_SIGNED',
  DOCUMENT_SHARED = 'DOCUMENT_SHARED',
  DOCUMENT_DELETED = 'DOCUMENT_DELETED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK',
  PROOF_GENERATED = 'PROOF_GENERATED',
  PROOF_VERIFIED = 'PROOF_VERIFIED'
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
  requestId: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface PaginationInput {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Filecoin specific types
export interface FilecoinDeal {
  dealId: string;
  clientAddress: string;
  providerAddress: string;
  pieceSize: number;
  pieceCid: string;
  startEpoch: number;
  endEpoch: number;
  storagePrice: string;
  isVerified: boolean;
  label: string;
}

export interface FilecoinStorageConfig {
  replicationFactor: number;
  duration: number; // in epochs
  maxPrice: string;
  verifiedDeal: boolean;
  fastRetrieval: boolean;
}

// Cryptography types
export interface EncryptionConfig {
  algorithm: EncryptionAlgorithm;
  keySize: number;
  mode: EncryptionMode;
}

export enum EncryptionAlgorithm {
  AES = 'AES',
  RSA = 'RSA',
  CHACHA20 = 'CHACHA20'
}

export enum EncryptionMode {
  GCM = 'GCM',
  CBC = 'CBC',
  CTR = 'CTR'
}

export interface HashConfig {
  algorithm: HashAlgorithm;
  salt?: string;
}

export enum HashAlgorithm {
  SHA256 = 'SHA256',
  SHA512 = 'SHA512',
  KECCAK256 = 'KECCAK256'
}

// Web3 types
export interface WalletConnection {
  address: string;
  chainId: number;
  networkName: string;
  provider: string;
  isConnected: boolean;
}

export interface Web3Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
  timestamp: Date;
}

// Configuration types
export interface AppConfig {
  name: string;
  version: string;
  environment: Environment;
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  filecoin: {
    network: string;
    endpoint: string;
    defaultStorageConfig: FilecoinStorageConfig;
  };
  security: {
    encryptionConfig: EncryptionConfig;
    hashConfig: HashConfig;
    jwtExpiresIn: string;
  };
  compliance: {
    auditRetentionDays: number;
    defaultComplianceLevel: ComplianceLevel;
    enabledFrameworks: ComplianceLevel[];
  };
}

export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

// Pilot Program types
export enum IndustryType {
  LAW_FIRM = 'LAW_FIRM',
  HEALTHCARE = 'HEALTHCARE',
  FINANCE = 'FINANCE',
  GOVERNMENT = 'GOVERNMENT',
  REAL_ESTATE = 'REAL_ESTATE',
  EDUCATION = 'EDUCATION',
  OTHER = 'OTHER'
}

export enum PilotStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'
}

export enum PilotGoal {
  COST_REDUCTION = 'COST_REDUCTION',
  COMPLIANCE_IMPROVEMENT = 'COMPLIANCE_IMPROVEMENT',
  WORKFLOW_EFFICIENCY = 'WORKFLOW_EFFICIENCY',
  SECURITY_ENHANCEMENT = 'SECURITY_ENHANCEMENT',
  SCALABILITY_TEST = 'SCALABILITY_TEST'
}

export interface PilotProgram {
  id: string;
  organizationName: string;
  industryType: IndustryType;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  companySize: CompanySize;
  currentSolution?: string;
  estimatedDocumentVolume: number;
  status: PilotStatus;
  startDate?: Date;
  endDate?: Date;
  goals: PilotGoal[];
  specialRequirements?: string;
  complianceNeeds: ComplianceLevel[];
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  completionReport?: string;
}

export enum CompanySize {
  SMALL = 'SMALL',          // 1-50 employees
  MEDIUM = 'MEDIUM',        // 51-250 employees
  LARGE = 'LARGE',          // 251-1000 employees
  ENTERPRISE = 'ENTERPRISE' // 1000+ employees
}

export interface PilotParticipant {
  id: string;
  pilotProgramId: string;
  userId: string;
  role: string;
  department?: string;
  joinedAt: Date;
  isActive: boolean;
  usageStats?: PilotUsageStats;
}

export interface PilotUsageStats {
  documentsUploaded: number;
  documentsSigned: number;
  verificationsPerformed: number;
  totalStorageUsed: number;
  averageSigningTime: number;
  collaborationCount: number;
  lastActivity: Date;
}

export interface PilotFeedback {
  id: string;
  pilotProgramId: string;
  participantId: string;
  category: FeedbackCategory;
  rating: number; // 1-5
  feedback: string;
  suggestedImprovements?: string;
  wouldRecommend: boolean;
  createdAt: Date;
  isPublic: boolean;
}

export enum FeedbackCategory {
  EASE_OF_USE = 'EASE_OF_USE',
  PERFORMANCE = 'PERFORMANCE',
  FEATURES = 'FEATURES',
  SUPPORT = 'SUPPORT',
  COMPLIANCE = 'COMPLIANCE',
  INTEGRATION = 'INTEGRATION',
  COST_VALUE = 'COST_VALUE',
  OVERALL = 'OVERALL'
}

export interface IndustryTemplate {
  id: string;
  industryType: IndustryType;
  name: string;
  description: string;
  templateType: TemplateType;
  documentFields: TemplateField[];
  workflowSteps: WorkflowStep[];
  complianceLevel: ComplianceLevel;
  estimatedCompletionTime: number; // in minutes
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum TemplateType {
  LEGAL_CONTRACT = 'LEGAL_CONTRACT',
  PATIENT_CONSENT = 'PATIENT_CONSENT',
  HIPAA_AUTHORIZATION = 'HIPAA_AUTHORIZATION',
  NDA = 'NDA',
  EMPLOYMENT_AGREEMENT = 'EMPLOYMENT_AGREEMENT',
  REAL_ESTATE_CONTRACT = 'REAL_ESTATE_CONTRACT',
  FINANCIAL_AGREEMENT = 'FINANCIAL_AGREEMENT',
  CUSTOM = 'CUSTOM'
}

export interface TemplateField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  validation?: string;
  defaultValue?: string;
  options?: string[];
  helpText?: string;
}

export enum FieldType {
  TEXT = 'TEXT',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  DATE = 'DATE',
  NUMBER = 'NUMBER',
  SELECT = 'SELECT',
  MULTISELECT = 'MULTISELECT',
  TEXTAREA = 'TEXTAREA',
  CHECKBOX = 'CHECKBOX',
  SIGNATURE = 'SIGNATURE',
  FILE_UPLOAD = 'FILE_UPLOAD'
}

export interface WorkflowStep {
  order: number;
  name: string;
  description: string;
  assignedRole: string;
  action: WorkflowAction;
  requiredFields?: string[];
  autoAdvance: boolean;
  estimatedDuration: number; // in minutes
}

export enum WorkflowAction {
  REVIEW = 'REVIEW',
  SIGN = 'SIGN',
  APPROVE = 'APPROVE',
  VERIFY = 'VERIFY',
  ARCHIVE = 'ARCHIVE',
  NOTIFY = 'NOTIFY'
}

// Enhanced Team types for pilot programs
export interface TeamPilotConfig {
  isPilotParticipant: boolean;
  pilotProgramId?: string;
  industryFocus: IndustryType;
  preferredTemplates: string[];
  customWorkflows: string[];
}

// Analytics for pilot programs
export interface PilotAnalytics {
  programId: string;
  totalParticipants: number;
  activeParticipants: number;
  documentsProcessed: number;
  signaturesCompleted: number;
  averageSatisfactionScore: number;
  costSavings: number;
  timeToCompletion: number;
  complianceScore: number;
  issuesReported: number;
  issuesResolved: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}
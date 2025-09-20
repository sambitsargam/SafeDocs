import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  scalar DateTime
  scalar Upload

  # User Types
  type User {
    id: ID!
    walletAddress: String!
    email: String
    displayName: String
    avatar: String
    role: UserRole!
    isEmailVerified: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastLoginAt: DateTime
    documents: [Document!]!
    signatures: [Signature!]!
  }

  enum UserRole {
    USER
    ADMIN
    ENTERPRISE
  }

  # Document Types
  type Document {
    id: ID!
    title: String!
    description: String
    originalFileName: String!
    mimeType: String!
    fileSize: Int!
    documentHash: String!
    encryptedData: String!
    ipfsCid: String!
    filecoinDealId: String
    uploadedBy: String!
    uploader: User!
    status: DocumentStatus!
    isEncrypted: Boolean!
    retentionPeriod: Int
    complianceLevel: ComplianceLevel!
    createdAt: DateTime!
    updatedAt: DateTime!
    signatures: [Signature!]!
    storageProofs: [StorageProof!]!
    auditLogs: [AuditLog!]!
  }

  enum DocumentStatus {
    UPLOADING
    UPLOADED
    PENDING_SIGNATURE
    SIGNED
    COMPLETED
    ARCHIVED
    DELETED
  }

  enum ComplianceLevel {
    STANDARD
    HIPAA
    SOX
    GDPR
    HIGH_SECURITY
  }

  # Signature Types
  type Signature {
    id: ID!
    documentId: String!
    document: Document!
    signerId: String!
    signer: User!
    signerWalletAddress: String!
    signerName: String!
    signerEmail: String
    signatureData: String!
    signatureAlgorithm: SignatureAlgorithm!
    signatureMetadata: SignatureMetadata!
    timestampSigned: DateTime!
    ipLocation: String
    deviceInfo: String
    isVerified: Boolean!
    verificationProof: String
    blockchainTxHash: String
  }

  enum SignatureAlgorithm {
    ECDSA
    RSA
    ED25519
  }

  type SignatureMetadata {
    documentVersion: String!
    documentHash: String!
    signingMethod: SigningMethod!
    certificateFingerprint: String
    timestamp: DateTime!
    ipAddress: String!
    userAgent: String!
    geolocation: Geolocation
  }

  enum SigningMethod {
    WALLET_SIGNATURE
    CERTIFICATE_BASED
    BIOMETRIC
  }

  type Geolocation {
    country: String!
    region: String!
    city: String!
  }

  # Storage Proof Types
  type StorageProof {
    id: ID!
    documentId: String!
    document: Document!
    proofType: ProofType!
    proofData: String!
    blockchainTxHash: String!
    storageProvider: String!
    createdAt: DateTime!
    expiresAt: DateTime
    isValid: Boolean!
    verificationCount: Int!
    lastVerifiedAt: DateTime
  }

  enum ProofType {
    PDP
    POR
    POW
    POS
  }

  # Audit Log Types
  type AuditLog {
    id: ID!
    userId: String
    user: User
    documentId: String
    document: Document
    action: AuditAction!
    details: String!
    ipAddress: String!
    userAgent: String!
    timestamp: DateTime!
    complianceLevel: ComplianceLevel!
    retentionDate: DateTime!
  }

  enum AuditAction {
    DOCUMENT_UPLOADED
    DOCUMENT_VIEWED
    DOCUMENT_DOWNLOADED
    DOCUMENT_SIGNED
    DOCUMENT_SHARED
    DOCUMENT_DELETED
    USER_LOGIN
    USER_LOGOUT
    PERMISSION_CHANGED
    COMPLIANCE_CHECK
    PROOF_GENERATED
    PROOF_VERIFIED
  }

  # Input Types
  input DocumentUploadInput {
    title: String!
    description: String
    file: Upload!
    complianceLevel: ComplianceLevel = STANDARD
    retentionPeriod: Int
  }

  input SignDocumentInput {
    documentId: ID!
    signatureData: String!
    signerName: String!
    signerEmail: String
    signingMethod: SigningMethod = WALLET_SIGNATURE
  }

  input PaginationInput {
    page: Int = 1
    limit: Int = 20
    sortBy: String = "createdAt"
    sortOrder: SortOrder = DESC
  }

  enum SortOrder {
    ASC
    DESC
  }

  input DocumentFilterInput {
    status: [DocumentStatus!]
    complianceLevel: [ComplianceLevel!]
    uploadedBy: String
    dateFrom: DateTime
    dateTo: DateTime
    search: String
  }

  # Response Types
  type PaginatedDocuments {
    items: [Document!]!
    pagination: PaginationInfo!
  }

  type PaginationInfo {
    page: Int!
    limit: Int!
    total: Int!
    totalPages: Int!
    hasNext: Boolean!
    hasPrev: Boolean!
  }

  type AuthPayload {
    token: String!
    user: User!
    wallet: WalletConnection!
  }

  type WalletConnection {
    address: String!
    chainId: Int!
    networkName: String!
    provider: String!
    isConnected: Boolean!
  }

  type VerificationResult {
    isValid: Boolean!
    document: Document!
    signatures: [Signature!]!
    storageProofs: [StorageProof!]!
    message: String
    verifiedAt: DateTime!
  }

  # Queries
  type Query {
    # User queries
    me: User
    user(id: ID!): User

    # Document queries
    documents(
      filter: DocumentFilterInput
      pagination: PaginationInput
    ): PaginatedDocuments!
    
    document(id: ID!): Document
    
    # Verification queries
    verifyDocument(id: ID!): VerificationResult!
    verifySignature(signatureId: ID!): VerificationResult!
    
    # Storage queries
    storageProofs(documentId: ID!): [StorageProof!]!
    
    # Audit queries
    auditLogs(
      documentId: ID
      userId: ID
      pagination: PaginationInput
    ): [AuditLog!]!
  }

  # Mutations
  type Mutation {
    # Authentication
    authenticate(
      walletAddress: String!
      signature: String!
      message: String!
      chainId: Int!
    ): AuthPayload!

    # Document operations
    uploadDocument(input: DocumentUploadInput!): Document!
    signDocument(input: SignDocumentInput!): Signature!
    shareDocument(documentId: ID!, recipientEmail: String!): Boolean!
    deleteDocument(id: ID!): Boolean!

    # User operations
    updateProfile(
      displayName: String
      email: String
      avatar: String
    ): User!

    # Storage operations
    generateStorageProof(documentId: ID!): StorageProof!
    verifyStorageProof(proofId: ID!): Boolean!

    # Admin operations
    regenerateProofs(documentId: ID!): [StorageProof!]!
  }

  # Subscriptions
  type Subscription {
    documentStatusChanged(documentId: ID!): Document!
    signatureAdded(documentId: ID!): Signature!
    proofGenerated(documentId: ID!): StorageProof!
  }
`;
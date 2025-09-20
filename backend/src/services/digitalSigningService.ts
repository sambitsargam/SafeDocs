import { ethers } from 'ethers';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import { documentService } from './documentService';

export interface SigningRequest {
  documentId: string;
  signerWalletAddress: string;
  signerName: string;
  signerEmail?: string;
  signatureData: string;
  signatureAlgorithm: 'ECDSA' | 'RSA' | 'ED25519';
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
}

export interface SignatureMetadata {
  documentVersion: string;
  documentHash: string;
  signingMethod: 'WALLET_SIGNATURE' | 'CERTIFICATE_BASED' | 'BIOMETRIC';
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

export interface VerificationResult {
  isValid: boolean;
  signatureValid: boolean;
  documentIntact: boolean;
  timestampValid: boolean;
  signerIdentified: boolean;
  certificateValid?: boolean;
  message: string;
}

export class DigitalSigningService {
  /**
   * Create a signing session for a document
   */
  async initiateSigningSession(
    documentId: string,
    signerWalletAddress: string
  ): Promise<{
    sessionId: string;
    signingChallenge: string;
    documentHash: string;
    expiresAt: Date;
  }> {
    try {
      logger.info(`Initiating signing session for document: ${documentId}`);

      // Get document details
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { uploader: true },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Generate signing challenge
      const sessionId = crypto.randomUUID();
      const nonce = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      const signingChallenge = this.generateSigningChallenge({
        documentId,
        documentHash: document.documentHash,
        signerWalletAddress,
        nonce,
        timestamp: new Date().toISOString(),
      });

      // Store signing session in database (would need a signing_sessions table)
      logger.info(`Signing session created: ${sessionId}`);

      return {
        sessionId,
        signingChallenge,
        documentHash: document.documentHash,
        expiresAt,
      };

    } catch (error) {
      logger.error('Failed to initiate signing session:', error);
      throw new Error(`Signing session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a digital signature for a document
   */
  async signDocument(signingRequest: SigningRequest): Promise<{
    signature: any;
    verificationResult: VerificationResult;
    blockchainTxHash?: string;
  }> {
    try {
      logger.info(`Processing signature for document: ${signingRequest.documentId}`);

      // Get document
      const document = await prisma.document.findUnique({
        where: { id: signingRequest.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Verify the signature
      const verificationResult = await this.verifySignature(
        document.documentHash,
        signingRequest.signatureData,
        signingRequest.signerWalletAddress
      );

      if (!verificationResult.isValid) {
        throw new Error(`Invalid signature: ${verificationResult.message}`);
      }

      // Create signature metadata
      const metadata: SignatureMetadata = {
        documentVersion: '1.0',
        documentHash: document.documentHash,
        signingMethod: 'WALLET_SIGNATURE',
        timestamp: new Date(),
        ipAddress: signingRequest.ipAddress || 'unknown',
        userAgent: signingRequest.userAgent || 'unknown',
        geolocation: signingRequest.location,
      };

      // Generate blockchain transaction hash (mock for now)
      const blockchainTxHash = this.generateTransactionHash(signingRequest);

      // Store signature in database
      const signature = await prisma.signature.create({
        data: {
          documentId: signingRequest.documentId,
          signerId: '', // Would be resolved from wallet address
          signerWalletAddress: signingRequest.signerWalletAddress,
          signerName: signingRequest.signerName,
          signerEmail: signingRequest.signerEmail,
          signatureData: signingRequest.signatureData,
          signatureAlgorithm: signingRequest.signatureAlgorithm,
          timestampSigned: new Date(),
          ipLocation: `${metadata.geolocation?.city || 'Unknown'}, ${metadata.geolocation?.country || 'Unknown'}`,
          deviceInfo: metadata.userAgent,
          isVerified: verificationResult.isValid,
          verificationProof: JSON.stringify({
            signatureValid: verificationResult.signatureValid,
            documentIntact: verificationResult.documentIntact,
            timestampValid: verificationResult.timestampValid,
            signerIdentified: verificationResult.signerIdentified,
          }),
          blockchainTxHash,
        },
      });

      // Update document status
      await prisma.document.update({
        where: { id: signingRequest.documentId },
        data: { 
          status: 'SIGNED',
          updatedAt: new Date(),
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          documentId: signingRequest.documentId,
          action: 'DOCUMENT_SIGNED',
          details: `Document signed by ${signingRequest.signerName} (${signingRequest.signerWalletAddress})`,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          complianceLevel: document.complianceLevel,
          retentionDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
        },
      });

      logger.info(`Document signed successfully: ${signingRequest.documentId} by ${signingRequest.signerWalletAddress}`);

      return {
        signature,
        verificationResult,
        blockchainTxHash,
      };

    } catch (error) {
      logger.error('Document signing failed:', error);
      throw new Error(`Document signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify a digital signature
   */
  async verifySignature(
    documentHash: string,
    signatureData: string,
    walletAddress: string
  ): Promise<VerificationResult> {
    try {
      logger.info(`Verifying signature for document hash: ${documentHash.substring(0, 16)}...`);

      // Step 1: Verify signature cryptographically
      const signatureValid = await this.verifyCryptographicSignature(
        documentHash,
        signatureData,
        walletAddress
      );

      // Step 2: Verify document integrity (document hash should match)
      const documentIntact = await this.verifyDocumentIntegrity(documentHash);

      // Step 3: Verify timestamp validity (signature not expired)
      const timestampValid = this.verifyTimestamp(signatureData);

      // Step 4: Verify signer identity
      const signerIdentified = await this.verifySignerIdentity(walletAddress);

      const isValid = signatureValid && documentIntact && timestampValid && signerIdentified;

      return {
        isValid,
        signatureValid,
        documentIntact,
        timestampValid,
        signerIdentified,
        message: isValid 
          ? 'Signature verified successfully'
          : this.getVerificationFailureMessage({
              signatureValid,
              documentIntact,
              timestampValid,
              signerIdentified,
            }),
      };

    } catch (error) {
      logger.error('Signature verification failed:', error);
      return {
        isValid: false,
        signatureValid: false,
        documentIntact: false,
        timestampValid: false,
        signerIdentified: false,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Batch verify multiple signatures on a document
   */
  async batchVerifySignatures(documentId: string): Promise<{
    documentValid: boolean;
    totalSignatures: number;
    validSignatures: number;
    invalidSignatures: number;
    verificationDetails: VerificationResult[];
  }> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          signatures: true,
        },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      const verificationPromises = document.signatures.map((signature: any) => 
        this.verifySignature(
          document.documentHash,
          signature.signatureData,
          signature.signerWalletAddress
        )
      );

      const verificationDetails = await Promise.all(verificationPromises);
      const validSignatures = verificationDetails.filter(v => v.isValid).length;
      const invalidSignatures = verificationDetails.length - validSignatures;

      logger.info(`Batch verification completed for document ${documentId}: ${validSignatures}/${verificationDetails.length} valid`);

      return {
        documentValid: invalidSignatures === 0,
        totalSignatures: verificationDetails.length,
        validSignatures,
        invalidSignatures,
        verificationDetails,
      };

    } catch (error) {
      logger.error('Batch verification failed:', error);
      throw new Error(`Batch verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a signing challenge message
   */
  private generateSigningChallenge(params: {
    documentId: string;
    documentHash: string;
    signerWalletAddress: string;
    nonce: string;
    timestamp: string;
  }): string {
    return `SafeDocs Digital Signature Challenge

Document ID: ${params.documentId}
Document Hash: ${params.documentHash}
Signer: ${params.signerWalletAddress}
Nonce: ${params.nonce}
Timestamp: ${params.timestamp}

By signing this message, you are creating a legally binding digital signature for the document referenced above.`;
  }

  /**
   * Verify cryptographic signature using ethers.js
   */
  private async verifyCryptographicSignature(
    documentHash: string,
    signatureData: string,
    walletAddress: string
  ): Promise<boolean> {
    try {
      // Create the message that should have been signed
      const message = `SafeDocs Document Signature\nDocument Hash: ${documentHash}`;
      
      // Recover the address from the signature
      const recoveredAddress = ethers.verifyMessage(message, signatureData);
      
      // Check if recovered address matches the claimed signer
      const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
      
      logger.debug(`Signature verification: ${isValid ? 'VALID' : 'INVALID'} - Expected: ${walletAddress}, Got: ${recoveredAddress}`);
      
      return isValid;

    } catch (error) {
      logger.error('Cryptographic signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify document integrity
   */
  private async verifyDocumentIntegrity(documentHash: string): Promise<boolean> {
    try {
      // In a real implementation, this would fetch the document from Filecoin
      // and recalculate its hash to ensure it hasn't been tampered with
      logger.debug(`Verifying document integrity for hash: ${documentHash}`);
      return true; // Placeholder - always return true for now

    } catch (error) {
      logger.error('Document integrity verification failed:', error);
      return false;
    }
  }

  /**
   * Verify timestamp validity
   */
  private verifyTimestamp(signatureData: string): boolean {
    try {
      // In a real implementation, this would extract timestamp from signature
      // and verify it's within acceptable bounds
      return true; // Placeholder

    } catch (error) {
      logger.error('Timestamp verification failed:', error);
      return false;
    }
  }

  /**
   * Verify signer identity
   */
  private async verifySignerIdentity(walletAddress: string): Promise<boolean> {
    try {
      // Check if the wallet address exists in our system
      const user = await prisma.user.findUnique({
        where: { walletAddress },
      });

      return user !== null;

    } catch (error) {
      logger.error('Signer identity verification failed:', error);
      return false;
    }
  }

  /**
   * Generate verification failure message
   */
  private getVerificationFailureMessage(checks: {
    signatureValid: boolean;
    documentIntact: boolean;
    timestampValid: boolean;
    signerIdentified: boolean;
  }): string {
    const failures = [];
    
    if (!checks.signatureValid) failures.push('Invalid cryptographic signature');
    if (!checks.documentIntact) failures.push('Document integrity compromised');
    if (!checks.timestampValid) failures.push('Signature timestamp invalid');
    if (!checks.signerIdentified) failures.push('Signer identity unverified');
    
    return `Verification failed: ${failures.join(', ')}`;
  }

  /**
   * Generate blockchain transaction hash (mock)
   */
  private generateTransactionHash(signingRequest: SigningRequest): string {
    const data = `${signingRequest.documentId}-${signingRequest.signerWalletAddress}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get signing statistics
   */
  async getSigningStats(timeframe: 'day' | 'week' | 'month' = 'month'): Promise<{
    totalSignatures: number;
    validSignatures: number;
    invalidSignatures: number;
    uniqueSigners: number;
    averageSigningTime: number;
    complianceBreakdown: any[];
  }> {
    try {
      const cutoffDate = new Date();
      switch (timeframe) {
        case 'day':
          cutoffDate.setDate(cutoffDate.getDate() - 1);
          break;
        case 'week':
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
      }

      const signatures = await prisma.signature.findMany({
        where: {
          timestampSigned: { gte: cutoffDate },
        },
        include: {
          document: true,
        },
      });

      const totalSignatures = signatures.length;
      const validSignatures = signatures.filter((s: any) => s.isVerified).length;
      const invalidSignatures = totalSignatures - validSignatures;
      const uniqueSigners = new Set(signatures.map((s: any) => s.signerWalletAddress)).size;

      // Calculate average signing time (mock calculation)
      const averageSigningTime = 2.5; // minutes

      const complianceBreakdown = signatures.reduce((acc: any, sig: any) => {
        const level = sig.document.complianceLevel;
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});

      return {
        totalSignatures,
        validSignatures,
        invalidSignatures,
        uniqueSigners,
        averageSigningTime,
        complianceBreakdown: Object.entries(complianceBreakdown).map(([level, count]) => ({
          level,
          count,
          percentage: ((count as number) / totalSignatures) * 100,
        })),
      };

    } catch (error) {
      logger.error('Failed to get signing stats:', error);
      throw new Error('Failed to retrieve signing statistics');
    }
  }
}

export const digitalSigningService = new DigitalSigningService();
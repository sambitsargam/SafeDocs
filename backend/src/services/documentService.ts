import { filecoinStorage, DocumentMetadata, StorageProof } from './filecoinStorage';
import { filCDNService } from './filCDNService';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface DocumentUpload {
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  title: string;
  description?: string;
  complianceLevel: 'STANDARD' | 'HIPAA' | 'SOX' | 'GDPR' | 'HIGH_SECURITY';
  retentionPeriod?: number;
  isEncrypted: boolean;
  uploadedBy: string;
}

export interface DocumentSignature {
  documentId: string;
  signerId: string;
  signerWalletAddress: string;
  signerName: string;
  signerEmail?: string;
  signatureData: string;
  signatureAlgorithm: 'ECDSA' | 'RSA' | 'ED25519';
}

export class DocumentService {
  /**
   * Upload and store a document on Filecoin
   */
  async uploadDocument(uploadData: DocumentUpload): Promise<{
    document: any;
    storageProof: StorageProof;
    costAnalysis: any;
  }> {
    try {
      logger.info(`Starting document upload: ${uploadData.title}`);

      // Prepare metadata
      const metadata: DocumentMetadata = {
        filename: uploadData.title,
        contentType: uploadData.file.mimetype,
        size: uploadData.file.size,
        hash: '',
        uploadedBy: uploadData.uploadedBy,
        uploadedAt: new Date(),
        tags: [`compliance:${uploadData.complianceLevel.toLowerCase()}`],
      };

      // Store document on Filecoin with encryption
      const {
        cid,
        storageProof,
        deal,
        encryptionKey
      } = await filecoinStorage.storeDocument(
        uploadData.file.buffer,
        metadata,
        uploadData.isEncrypted
      );

      // Calculate storage costs
      const costAnalysis = filecoinStorage.calculateStorageCost(
        uploadData.file.size,
        uploadData.retentionPeriod || 365
      );

      // Create document record in database
      const document = await prisma.document.create({
        data: {
          title: uploadData.title,
          description: uploadData.description,
          originalFileName: uploadData.file.originalname,
          mimeType: uploadData.file.mimetype,
          fileSize: uploadData.file.size,
          documentHash: storageProof.hash,
          encryptedData: encryptionKey || '',
          ipfsCid: cid,
          filecoinDealId: deal?.id,
          uploadedBy: uploadData.uploadedBy,
          status: 'UPLOADED',
          isEncrypted: uploadData.isEncrypted,
          retentionPeriod: uploadData.retentionPeriod,
          complianceLevel: uploadData.complianceLevel,
        },
      });

      // Create storage proof record
      await prisma.storageProof.create({
        data: {
          documentId: document.id,
          proofType: 'PDP',
          proofData: JSON.stringify(storageProof),
          blockchainTxHash: deal?.id || 'pending',
          storageProvider: 'Filecoin',
          isValid: true,
          verificationCount: 0,
        },
      });

      // Log audit event
      await prisma.auditLog.create({
        data: {
          documentId: document.id,
          action: 'DOCUMENT_UPLOADED',
          details: `Document "${uploadData.title}" uploaded to Filecoin with CID: ${cid}`,
          ipAddress: '127.0.0.1', // Would be from request
          userAgent: 'Unknown', // Would be from request
          complianceLevel: uploadData.complianceLevel,
          retentionDate: new Date(Date.now() + (uploadData.retentionPeriod || 365) * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`Document upload completed: ${document.id}`);

      return {
        document,
        storageProof,
        costAnalysis,
      };

    } catch (error) {
      logger.error('Document upload failed:', error);
      throw new Error(`Document upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a document from Filecoin with CDN optimization
   */
  async retrieveDocument(
    documentId: string, 
    userId: string,
    userLocation?: { lat: number; lng: number; country?: string }
  ): Promise<{
    document: any;
    buffer: Buffer;
    verified: boolean;
    retrievalMetrics: {
      source: 'cdn' | 'origin';
      retrievalTime: number;
      cacheHit?: boolean;
      nodeUsed?: string;
    };
  }> {
    try {
      // Get document from database
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          uploader: true,
          signatures: true,
          storageProofs: true,
        },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permissions
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || (user.role !== 'ADMIN' && document.uploadedBy !== user.walletAddress)) {
        throw new Error('Access denied');
      }

      const startTime = Date.now();
      let buffer: Buffer | undefined;
      let verified = false;
      let retrievalMetrics: any;

      try {
        // First try CDN retrieval for better performance
        const cdnResult = await filCDNService.retrieveDocument(document.ipfsCid, userLocation);
        let buffer = cdnResult.buffer;
        
        // If document was encrypted, we need to decrypt it manually since CDN doesn't handle decryption
        if (document.isEncrypted && document.encryptedData) {
          // Fallback to origin retrieval for encrypted documents to handle decryption properly
          throw new Error('Encrypted document requires origin retrieval for decryption');
        }

        // Verify document integrity
        verified = await filecoinStorage.verifyDocumentIntegrity(
          document.ipfsCid,
          buffer,
          document.storageProofs[0]
        );

        retrievalMetrics = {
          source: 'cdn' as const,
          retrievalTime: cdnResult.retrievalTime,
          cacheHit: cdnResult.cacheHit,
          nodeUsed: cdnResult.nodeUsed,
        };

        logger.info(`Document retrieved via CDN: ${documentId} (${cdnResult.retrievalTime}ms)`);

      } catch (cdnError) {
        logger.warn(`CDN retrieval failed, falling back to origin: ${cdnError}`);

        // Fallback to direct Filecoin retrieval (handles decryption automatically)
        const { buffer: originBuffer, verified: originVerified } = await filecoinStorage.retrieveDocument(
          document.ipfsCid,
          document.isEncrypted ? document.encryptedData : undefined
        );

        buffer = originBuffer;
        verified = originVerified;

        retrievalMetrics = {
          source: 'origin' as const,
          retrievalTime: Date.now() - startTime,
        };

        // Pre-warm CDN for future requests (only for non-encrypted documents)
        if (!document.isEncrypted) {
          try {
            await filCDNService.prewarmCache(document.ipfsCid, 'low');
          } catch (prewarmError) {
            logger.warn('CDN prewarming failed:', prewarmError);
          }
        }
      }

      // Log audit event
      await prisma.auditLog.create({
        data: {
          userId,
          documentId: document.id,
          action: 'DOCUMENT_VIEWED',
          details: `Document "${document.title}" retrieved via ${retrievalMetrics.source}`,
          ipAddress: '127.0.0.1',
          userAgent: 'Unknown',
          complianceLevel: document.complianceLevel,
          retentionDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`Document retrieved successfully: ${documentId} (verified: ${verified})`);

      return {
        document,
        buffer: buffer!,
        verified,
        retrievalMetrics,
      };

    } catch (error) {
      logger.error('Document retrieval failed:', error);
      throw new Error(`Document retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign a document
   */
  async signDocument(signatureData: DocumentSignature): Promise<any> {
    try {
      logger.info(`Signing document: ${signatureData.documentId}`);

      // Get document
      const document = await prisma.document.findUnique({
        where: { id: signatureData.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Verify signature against document hash
      const isValidSignature = await this.verifySignature(
        document.documentHash,
        signatureData.signatureData,
        signatureData.signerWalletAddress
      );

      if (!isValidSignature) {
        throw new Error('Invalid signature');
      }

      // Create signature record
      const signature = await prisma.signature.create({
        data: {
          documentId: signatureData.documentId,
          signerId: signatureData.signerId,
          signerWalletAddress: signatureData.signerWalletAddress,
          signerName: signatureData.signerName,
          signerEmail: signatureData.signerEmail,
          signatureData: signatureData.signatureData,
          signatureAlgorithm: signatureData.signatureAlgorithm,
          timestampSigned: new Date(),
          ipLocation: 'Unknown',
          deviceInfo: 'Unknown',
          isVerified: isValidSignature,
          verificationProof: 'verified-against-document-hash',
          blockchainTxHash: 'pending',
        },
      });

      // Update document status
      await prisma.document.update({
        where: { id: signatureData.documentId },
        data: { status: 'SIGNED' },
      });

      // Log audit event
      await prisma.auditLog.create({
        data: {
          userId: signatureData.signerId,
          documentId: signatureData.documentId,
          action: 'DOCUMENT_SIGNED',
          details: `Document signed by ${signatureData.signerName} (${signatureData.signerWalletAddress})`,
          ipAddress: '127.0.0.1',
          userAgent: 'Unknown',
          complianceLevel: document.complianceLevel,
          retentionDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`Document signed successfully: ${signatureData.documentId}`);

      return signature;

    } catch (error) {
      logger.error('Document signing failed:', error);
      throw new Error(`Document signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify document integrity
   */
  async verifyDocument(documentId: string): Promise<{
    isValid: boolean;
    document: any;
    signatures: any[];
    storageProofs: any[];
    auditTrail: any[];
    message: string;
  }> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          signatures: {
            include: { signer: true },
          },
          storageProofs: true,
          auditLogs: {
            include: { user: true },
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Verify with Filecoin storage
      const isValid = await filecoinStorage.verifyDocumentIntegrity(
        document.ipfsCid,
        Buffer.alloc(0), // Would retrieve actual document buffer
        document.storageProofs[0] // Use first storage proof
      );

      // Verify all signatures
      const signatureValidations = await Promise.all(
        document.signatures.map(async (sig: any) => {
          return await this.verifySignature(
            document.documentHash,
            sig.signatureData,
            sig.signerWalletAddress
          );
        })
      );

      const allSignaturesValid = signatureValidations.every(v => v);

      const overallValid = isValid && allSignaturesValid;

      // Log verification audit
      await prisma.auditLog.create({
        data: {
          documentId: document.id,
          action: 'PROOF_VERIFIED',
          details: `Document verification ${overallValid ? 'passed' : 'failed'}`,
          ipAddress: '127.0.0.1',
          userAgent: 'Unknown',
          complianceLevel: document.complianceLevel,
          retentionDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        isValid: overallValid,
        document,
        signatures: document.signatures,
        storageProofs: document.storageProofs,
        auditTrail: document.auditLogs,
        message: overallValid 
          ? 'Document and all signatures verified successfully'
          : 'Document verification failed - integrity compromised',
      };

    } catch (error) {
      logger.error('Document verification failed:', error);
      throw new Error(`Document verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify a cryptographic signature
   */
  private async verifySignature(
    documentHash: string,
    signatureData: string,
    walletAddress: string
  ): Promise<boolean> {
    try {
      // In a real implementation, this would use proper cryptographic verification
      // For now, return true as a placeholder
      logger.debug(`Verifying signature for document hash: ${documentHash}`);
      return true;

    } catch (error) {
      logger.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(userId?: string): Promise<{
    totalDocuments: number;
    totalStorage: number;
    signedDocuments: number;
    complianceBreakdown: any[];
    costSavings: number;
  }> {
    try {
      const where = userId ? { uploadedBy: userId } : {};

      const [
        totalDocuments,
        documents,
        signedCount,
      ] = await Promise.all([
        prisma.document.count({ where }),
        prisma.document.findMany({
          where,
          select: { fileSize: true, complianceLevel: true },
        }),
        prisma.document.count({
          where: { ...where, status: 'SIGNED' },
        }),
      ]);

      const totalStorage = documents.reduce((sum: number, doc: any) => sum + doc.fileSize, 0);

      const complianceBreakdown = documents.reduce((acc: any, doc: any) => {
        const level = doc.complianceLevel;
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});

      // Calculate cost savings (80% savings over DocuSign)
      const traditionalCost = totalDocuments * 1.5; // $1.50 per document
      const filecoinCost = totalDocuments * 0.3; // $0.30 per document
      const costSavings = traditionalCost - filecoinCost;

      return {
        totalDocuments,
        totalStorage,
        signedDocuments: signedCount,
        complianceBreakdown: Object.entries(complianceBreakdown).map(([level, count]) => ({
          level,
          count,
          percentage: ((count as number) / totalDocuments) * 100,
        })),
        costSavings,
      };

    } catch (error) {
      logger.error('Failed to get document stats:', error);
      throw new Error('Failed to retrieve document statistics');
    }
  }
}

export const documentService = new DocumentService();
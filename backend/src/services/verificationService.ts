import { filecoinStorage } from './filecoinStorage';
import { digitalSigningService } from './digitalSigningService';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { ethers } from 'ethers';

export interface VerificationResult {
  isValid: boolean;
  confidence: number; // 0-100 confidence score
  verificationLevel: 'BASIC' | 'STANDARD' | 'ENHANCED' | 'MAXIMUM';
  timestamp: Date;
  verificationId: string;
  checks: {
    documentIntegrity: boolean;
    storageProof: boolean;
    signatures: boolean;
    blockchain: boolean;
    compliance: boolean;
    auditTrail: boolean;
  };
  details: {
    documentHash: string;
    pdpProofValid: boolean;
    signatureCount: number;
    validSignatures: number;
    blockchainTxVerified: boolean;
    complianceLevel: string;
    auditEventCount: number;
    anomaliesDetected: string[];
    trustScore: number;
  };
  metrics: {
    verificationTimeMs: number;
    checksPerformed: number;
    dataIntegrityScore: number;
    cryptographicScore: number;
    complianceScore: number;
  };
  recommendations?: string[];
  warnings?: string[];
}

export interface BatchVerificationResult {
  results: VerificationResult[];
  summary: {
    totalDocuments: number;
    validDocuments: number;
    invalidDocuments: number;
    averageConfidence: number;
    timeElapsed: number;
  };
  patterns: {
    commonIssues: string[];
    riskFactors: string[];
    recommendations: string[];
  };
}

export class VerificationService {
  /**
   * Perform comprehensive document verification
   */
  async verifyDocument(
    documentId: string,
    verificationLevel: 'BASIC' | 'STANDARD' | 'ENHANCED' | 'MAXIMUM' = 'STANDARD'
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    const verificationId = crypto.randomUUID();
    
    try {
      logger.info(`Starting verification for document: ${documentId} (level: ${verificationLevel})`);

      // Get document with all related data
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          uploader: true,
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

      // Initialize verification checks
      const checks = {
        documentIntegrity: false,
        storageProof: false,
        signatures: false,
        blockchain: false,
        compliance: false,
        auditTrail: false,
      };

      const details = {
        documentHash: document.documentHash,
        pdpProofValid: false,
        signatureCount: document.signatures.length,
        validSignatures: 0,
        blockchainTxVerified: false,
        complianceLevel: document.complianceLevel,
        auditEventCount: document.auditLogs.length,
        anomaliesDetected: [] as string[],
        trustScore: 0,
      };

      const warnings: string[] = [];
      const recommendations: string[] = [];

      // 1. Document Integrity Check
      try {
        if (verificationLevel !== 'BASIC') {
          // Retrieve document content for hash verification
          const { buffer, verified } = await filecoinStorage.retrieveDocument(
            document.ipfsCid,
            document.isEncrypted ? document.encryptedData : undefined
          );

          // Verify document hash
          const calculatedHash = crypto.createHash('sha256').update(buffer).digest('hex');
          checks.documentIntegrity = calculatedHash === document.documentHash && verified;

          if (!checks.documentIntegrity) {
            details.anomaliesDetected.push('Document hash mismatch or corruption detected');
          }
        } else {
          // Basic check - just verify storage proof exists
          checks.documentIntegrity = document.storageProofs.length > 0;
        }
      } catch (error) {
        logger.warn(`Document integrity check failed: ${error}`);
        details.anomaliesDetected.push('Document retrieval failed');
      }

      // 2. PDP Storage Proof Verification
      try {
        if (document.storageProofs.length > 0) {
          const storageProof = JSON.parse(document.storageProofs[0].proofData);
          
          // Verify PDP proof with Filecoin network
          const pdpValid = await this.verifyPDPProof(
            document.ipfsCid,
            storageProof,
            document.storageProofs[0].blockchainTxHash
          );

          details.pdpProofValid = pdpValid;
          checks.storageProof = pdpValid;

          if (!pdpValid) {
            details.anomaliesDetected.push('PDP storage proof validation failed');
            warnings.push('Document storage integrity cannot be verified on Filecoin network');
          }
        } else {
          warnings.push('No storage proofs found for this document');
        }
      } catch (error) {
        logger.warn(`PDP proof verification failed: ${error}`);
        details.anomaliesDetected.push('PDP proof verification error');
      }

      // 3. Digital Signature Verification
      try {
        if (document.signatures.length > 0) {
          const signatureResults = await Promise.allSettled(
            document.signatures.map(async (sig: any) => {
              return await digitalSigningService.verifySignature(
                document.documentHash,
                sig.signatureData,
                sig.signerWalletAddress
              );
            })
          );

          details.validSignatures = signatureResults.filter(
            result => result.status === 'fulfilled' && result.value
          ).length;

          checks.signatures = details.validSignatures === details.signatureCount;

          if (details.validSignatures < details.signatureCount) {
            details.anomaliesDetected.push(`${details.signatureCount - details.validSignatures} invalid signatures detected`);
            warnings.push('Some digital signatures could not be verified');
          }
        } else {
          checks.signatures = true; // No signatures to verify
        }
      } catch (error) {
        logger.warn(`Signature verification failed: ${error}`);
        details.anomaliesDetected.push('Signature verification error');
      }

      // 4. Blockchain Transaction Verification
      try {
        if (verificationLevel === 'ENHANCED' || verificationLevel === 'MAXIMUM') {
          if (document.storageProofs[0]?.blockchainTxHash && document.storageProofs[0].blockchainTxHash !== 'pending') {
            const txVerified = await this.verifyBlockchainTransaction(
              document.storageProofs[0].blockchainTxHash,
              document.ipfsCid
            );
            details.blockchainTxVerified = txVerified;
            checks.blockchain = txVerified;

            if (!txVerified) {
              details.anomaliesDetected.push('Blockchain transaction verification failed');
              warnings.push('Document storage transaction not found on blockchain');
            }
          } else {
            warnings.push('No blockchain transaction hash available for verification');
          }
        } else {
          checks.blockchain = true; // Skip for basic/standard levels
        }
      } catch (error) {
        logger.warn(`Blockchain verification failed: ${error}`);
        details.anomaliesDetected.push('Blockchain verification error');
      }

      // 5. Compliance Check
      try {
        const complianceResult = await this.verifyCompliance(document, verificationLevel);
        checks.compliance = complianceResult.isCompliant;

        if (!complianceResult.isCompliant) {
          details.anomaliesDetected.push(...complianceResult.violations);
          warnings.push(...complianceResult.warnings);
          recommendations.push(...complianceResult.recommendations);
        }
      } catch (error) {
        logger.warn(`Compliance verification failed: ${error}`);
        details.anomaliesDetected.push('Compliance verification error');
      }

      // 6. Audit Trail Verification
      try {
        const auditResult = await this.verifyAuditTrail(document.auditLogs, verificationLevel);
        checks.auditTrail = auditResult.isValid;

        if (!auditResult.isValid) {
          details.anomaliesDetected.push(...auditResult.anomalies);
          warnings.push(...auditResult.warnings);
        }
      } catch (error) {
        logger.warn(`Audit trail verification failed: ${error}`);
        details.anomaliesDetected.push('Audit trail verification error');
      }

      // Calculate overall verification result
      const checksPerformed = Object.values(checks).length;
      const passedChecks = Object.values(checks).filter(Boolean).length;
      const confidence = Math.round((passedChecks / checksPerformed) * 100);

      // Calculate trust score
      details.trustScore = this.calculateTrustScore(checks, details, document);

      // Calculate metrics
      const metrics = {
        verificationTimeMs: Date.now() - startTime,
        checksPerformed,
        dataIntegrityScore: this.calculateDataIntegrityScore(checks, details),
        cryptographicScore: this.calculateCryptographicScore(checks, details),
        complianceScore: this.calculateComplianceScore(checks, details),
      };

      // Determine overall validity
      const isValid = confidence >= this.getMinimumConfidenceThreshold(verificationLevel) && 
                     details.anomaliesDetected.length === 0;

      // Add recommendations based on verification level
      if (verificationLevel === 'BASIC' && isValid) {
        recommendations.push('Consider running STANDARD or ENHANCED verification for better security assurance');
      }

      // Log verification event
      await prisma.auditLog.create({
        data: {
          documentId: document.id,
          action: 'DOCUMENT_VERIFIED',
          details: `Document verification completed: ${isValid ? 'VALID' : 'INVALID'} (confidence: ${confidence}%)`,
          ipAddress: '127.0.0.1',
          userAgent: 'VerificationService',
          complianceLevel: document.complianceLevel,
          retentionDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
        },
      });

      // Store verification result
      await prisma.verificationResult.create({
        data: {
          id: verificationId,
          documentId: document.id,
          verificationLevel,
          isValid,
          confidence,
          details: JSON.stringify(details),
          checks: JSON.stringify(checks),
          metrics: JSON.stringify(metrics),
          anomalies: details.anomaliesDetected,
          warnings,
          recommendations,
        },
      });

      logger.info(`Verification completed for document: ${documentId} (${isValid ? 'VALID' : 'INVALID'}, ${confidence}% confidence)`);

      return {
        isValid,
        confidence,
        verificationLevel,
        timestamp: new Date(),
        verificationId,
        checks,
        details,
        metrics,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

    } catch (error) {
      logger.error('Document verification failed:', error);
      throw new Error(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch verify multiple documents
   */
  async batchVerifyDocuments(
    documentIds: string[],
    verificationLevel: 'BASIC' | 'STANDARD' | 'ENHANCED' | 'MAXIMUM' = 'STANDARD'
  ): Promise<BatchVerificationResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting batch verification for ${documentIds.length} documents`);

      // Verify documents in parallel (limited concurrency)
      const BATCH_SIZE = 5;
      const results: VerificationResult[] = [];

      for (let i = 0; i < documentIds.length; i += BATCH_SIZE) {
        const batch = documentIds.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(id => this.verifyDocument(id, verificationLevel))
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            logger.warn(`Batch verification failed for document: ${result.reason}`);
          }
        }
      }

      // Calculate summary statistics
      const validDocuments = results.filter(r => r.isValid).length;
      const invalidDocuments = results.length - validDocuments;
      const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

      // Analyze patterns
      const commonIssues = this.analyzeCommonIssues(results);
      const riskFactors = this.identifyRiskFactors(results);
      const batchRecommendations = this.generateBatchRecommendations(results);

      const summary = {
        totalDocuments: results.length,
        validDocuments,
        invalidDocuments,
        averageConfidence: Math.round(averageConfidence),
        timeElapsed: Date.now() - startTime,
      };

      const patterns = {
        commonIssues,
        riskFactors,
        recommendations: batchRecommendations,
      };

      logger.info(`Batch verification completed: ${validDocuments}/${results.length} valid documents`);

      return {
        results,
        summary,
        patterns,
      };

    } catch (error) {
      logger.error('Batch verification failed:', error);
      throw new Error(`Batch verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify PDP (Provable Data Possession) proof
   */
  private async verifyPDPProof(
    cid: string,
    storageProof: any,
    blockchainTxHash: string
  ): Promise<boolean> {
    try {
      // Verify proof structure
      if (!storageProof.hash || !storageProof.timestamp || !storageProof.challenge) {
        return false;
      }

      // Verify proof timestamp is recent (within acceptable range)
      const proofAge = Date.now() - new Date(storageProof.timestamp).getTime();
      const MAX_PROOF_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
      
      if (proofAge > MAX_PROOF_AGE) {
        logger.warn(`PDP proof is too old: ${proofAge}ms`);
        return false;
      }

      // Verify challenge response
      const expectedResponse = crypto
        .createHash('sha256')
        .update(cid + storageProof.challenge + storageProof.timestamp)
        .digest('hex');

      if (storageProof.response !== expectedResponse) {
        logger.warn('PDP proof challenge response mismatch');
        return false;
      }

      // Additional verification with Filecoin network (simulated)
      // In a real implementation, this would query the Filecoin network
      // to verify the storage deal and proof of storage
      const networkVerified = await this.simulateFilecoinNetworkVerification(cid, blockchainTxHash);

      return networkVerified;

    } catch (error) {
      logger.error('PDP proof verification failed:', error);
      return false;
    }
  }

  /**
   * Verify blockchain transaction
   */
  private async verifyBlockchainTransaction(txHash: string, expectedCid: string): Promise<boolean> {
    try {
      // In a real implementation, this would connect to the Filecoin network
      // and verify the transaction exists and contains the expected CID
      
      // Simulate blockchain verification
      if (txHash === 'pending' || !txHash) {
        return false;
      }

      // Basic format validation
      if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
        return false;
      }

      // Simulate successful verification
      // In production, this would use Filecoin APIs or RPC calls
      return true;

    } catch (error) {
      logger.error('Blockchain transaction verification failed:', error);
      return false;
    }
  }

  /**
   * Verify compliance requirements
   */
  private async verifyCompliance(document: any, verificationLevel: string): Promise<{
    isCompliant: boolean;
    violations: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const violations: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      const complianceLevel = document.complianceLevel;

      // Check retention requirements
      if (document.retentionPeriod) {
        const uploadAge = Date.now() - new Date(document.createdAt).getTime();
        const retentionMs = document.retentionPeriod * 24 * 60 * 60 * 1000;
        
        if (uploadAge > retentionMs) {
          violations.push(`Document exceeds retention period (${document.retentionPeriod} days)`);
        }
      }

      // HIPAA specific checks
      if (complianceLevel === 'HIPAA') {
        if (!document.isEncrypted) {
          violations.push('HIPAA compliance requires document encryption');
        }
        
        if (document.auditLogs.length < 2) {
          warnings.push('HIPAA requires comprehensive audit trails');
        }

        if (verificationLevel === 'BASIC') {
          recommendations.push('HIPAA documents should use ENHANCED or MAXIMUM verification');
        }
      }

      // SOX specific checks
      if (complianceLevel === 'SOX') {
        if (document.signatures.length === 0) {
          violations.push('SOX compliance typically requires digital signatures');
        }

        const hasManagementSignature = document.signatures.some((sig: any) => 
          sig.signer?.role === 'ADMIN' || sig.signer?.role === 'MANAGER'
        );

        if (!hasManagementSignature) {
          warnings.push('SOX compliance may require management-level signatures');
        }
      }

      // GDPR specific checks
      if (complianceLevel === 'GDPR') {
        if (!document.isEncrypted) {
          violations.push('GDPR compliance requires data encryption for personal data');
        }

        // Check for data subject rights compliance
        const hasDataSubjectAccess = document.auditLogs.some((log: any) => 
          log.action === 'DATA_SUBJECT_ACCESS'
        );

        if (!hasDataSubjectAccess) {
          recommendations.push('Consider implementing data subject access controls');
        }
      }

      // High security checks
      if (complianceLevel === 'HIGH_SECURITY') {
        if (!document.isEncrypted) {
          violations.push('High security documents must be encrypted');
        }

        if (verificationLevel !== 'MAXIMUM') {
          recommendations.push('High security documents should use MAXIMUM verification level');
        }
      }

      return {
        isCompliant: violations.length === 0,
        violations,
        warnings,
        recommendations,
      };

    } catch (error) {
      logger.error('Compliance verification failed:', error);
      return {
        isCompliant: false,
        violations: ['Compliance verification failed'],
        warnings: [],
        recommendations: [],
      };
    }
  }

  /**
   * Verify audit trail integrity
   */
  private async verifyAuditTrail(auditLogs: any[], verificationLevel: string): Promise<{
    isValid: boolean;
    anomalies: string[];
    warnings: string[];
  }> {
    const anomalies: string[] = [];
    const warnings: string[] = [];

    try {
      if (auditLogs.length === 0) {
        warnings.push('No audit trail found');
        return { isValid: false, anomalies, warnings };
      }

      // Check for required audit events
      const requiredEvents = ['DOCUMENT_UPLOADED'];
      const presentEvents = auditLogs.map(log => log.action);

      for (const event of requiredEvents) {
        if (!presentEvents.includes(event)) {
          anomalies.push(`Missing required audit event: ${event}`);
        }
      }

      // Check for chronological order
      for (let i = 1; i < auditLogs.length; i++) {
        const prevTime = new Date(auditLogs[i - 1].timestamp).getTime();
        const currTime = new Date(auditLogs[i].timestamp).getTime();

        if (currTime < prevTime) {
          anomalies.push('Audit trail chronological order violation detected');
          break;
        }
      }

      // Check for suspicious patterns
      const actionCounts = auditLogs.reduce((acc: any, log: any) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {});

      // Detect potential replay attacks
      if (actionCounts.DOCUMENT_VIEWED > 100) {
        warnings.push('Unusually high number of document views detected');
      }

      // Check for gaps in audit trail
      if (verificationLevel === 'ENHANCED' || verificationLevel === 'MAXIMUM') {
        const timeGaps = this.detectAuditTrailGaps(auditLogs);
        if (timeGaps.length > 0) {
          warnings.push(`${timeGaps.length} potential gaps detected in audit trail`);
        }
      }

      return {
        isValid: anomalies.length === 0,
        anomalies,
        warnings,
      };

    } catch (error) {
      logger.error('Audit trail verification failed:', error);
      return {
        isValid: false,
        anomalies: ['Audit trail verification failed'],
        warnings: [],
      };
    }
  }

  /**
   * Calculate trust score based on verification results
   */
  private calculateTrustScore(checks: any, details: any, document: any): number {
    let score = 0;

    // Base score from passed checks
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.values(checks).length;
    score += (passedChecks / totalChecks) * 40;

    // Signature verification score
    if (details.signatureCount > 0) {
      score += (details.validSignatures / details.signatureCount) * 20;
    } else {
      score += 10; // Neutral score for unsigned documents
    }

    // Storage proof score
    if (details.pdpProofValid) {
      score += 20;
    }

    // Compliance score
    if (checks.compliance) {
      score += 10;
    }

    // Audit trail score
    if (checks.auditTrail && details.auditEventCount > 3) {
      score += 10;
    }

    // Deduct points for anomalies
    score -= details.anomaliesDetected.length * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate various scoring metrics
   */
  private calculateDataIntegrityScore(checks: any, details: any): number {
    let score = 0;
    if (checks.documentIntegrity) score += 40;
    if (checks.storageProof) score += 40;
    if (details.pdpProofValid) score += 20;
    return Math.min(100, score);
  }

  private calculateCryptographicScore(checks: any, details: any): number {
    let score = 0;
    if (checks.signatures) score += 50;
    if (details.validSignatures > 0) score += 30;
    if (checks.blockchain) score += 20;
    return Math.min(100, score);
  }

  private calculateComplianceScore(checks: any, details: any): number {
    let score = 0;
    if (checks.compliance) score += 60;
    if (checks.auditTrail) score += 40;
    return Math.min(100, score);
  }

  /**
   * Get minimum confidence threshold for verification level
   */
  private getMinimumConfidenceThreshold(level: string): number {
    switch (level) {
      case 'BASIC': return 60;
      case 'STANDARD': return 75;
      case 'ENHANCED': return 85;
      case 'MAXIMUM': return 95;
      default: return 75;
    }
  }

  /**
   * Batch analysis helpers
   */
  private analyzeCommonIssues(results: VerificationResult[]): string[] {
    const issueMap: { [key: string]: number } = {};
    
    results.forEach(result => {
      result.details.anomaliesDetected.forEach(anomaly => {
        issueMap[anomaly] = (issueMap[anomaly] || 0) + 1;
      });
    });

    return Object.entries(issueMap)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([issue, count]) => `${issue} (${count} documents)`);
  }

  private identifyRiskFactors(results: VerificationResult[]): string[] {
    const riskFactors: string[] = [];
    
    const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    if (averageConfidence < 80) {
      riskFactors.push('Low average confidence score across documents');
    }

    const invalidCount = results.filter(r => !r.isValid).length;
    if (invalidCount > results.length * 0.1) {
      riskFactors.push('High rate of invalid documents detected');
    }

    return riskFactors;
  }

  private generateBatchRecommendations(results: VerificationResult[]): string[] {
    const recommendations: string[] = [];
    
    const basicCount = results.filter(r => r.verificationLevel === 'BASIC').length;
    if (basicCount > results.length * 0.5) {
      recommendations.push('Consider upgrading verification level for better security assurance');
    }

    const unsignedCount = results.filter(r => r.details.signatureCount === 0).length;
    if (unsignedCount > 0) {
      recommendations.push(`${unsignedCount} documents are unsigned - consider implementing digital signatures`);
    }

    return recommendations;
  }

  /**
   * Simulate Filecoin network verification
   */
  private async simulateFilecoinNetworkVerification(cid: string, txHash: string): Promise<boolean> {
    // In a real implementation, this would query the Filecoin network
    // For now, simulate a successful verification
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    return txHash !== 'pending' && cid.length > 0;
  }

  /**
   * Detect gaps in audit trail
   */
  private detectAuditTrailGaps(auditLogs: any[]): any[] {
    const gaps: any[] = [];
    const EXPECTED_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    for (let i = 1; i < auditLogs.length; i++) {
      const prevTime = new Date(auditLogs[i - 1].timestamp).getTime();
      const currTime = new Date(auditLogs[i].timestamp).getTime();
      const gap = currTime - prevTime;

      if (gap > EXPECTED_INTERVAL * 7) { // Gap longer than 7 days
        gaps.push({
          start: auditLogs[i - 1].timestamp,
          end: auditLogs[i].timestamp,
          duration: gap,
        });
      }
    }

    return gaps;
  }
}

export const verificationService = new VerificationService();
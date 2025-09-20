import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface AuditTrailEntry {
  userId?: string;
  documentId?: string;
  action: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  complianceLevel?: 'STANDARD' | 'HIPAA' | 'SOX' | 'GDPR' | 'HIGH_SECURITY';
  retentionDate?: Date;
  metadata?: any;
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: Date;
  generatedBy: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  complianceFramework: 'HIPAA' | 'SOX' | 'GDPR' | 'SOC2' | 'ALL';
  summary: {
    totalDocuments: number;
    compliantDocuments: number;
    nonCompliantDocuments: number;
    complianceScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  findings: ComplianceFinding[];
  recommendations: string[];
  certificationStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
}

export interface ComplianceFinding {
  id: string;
  type: 'VIOLATION' | 'WARNING' | 'OBSERVATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  description: string;
  affected: {
    documents: string[];
    users: string[];
    systems: string[];
  };
  evidence: any[];
  remediation: {
    required: boolean;
    deadline?: Date;
    steps: string[];
    responsible: string;
  };
}

export interface AccessControlPolicy {
  id: string;
  name: string;
  description: string;
  resources: string[];
  permissions: string[];
  conditions: any;
  isActive: boolean;
  complianceFramework: string[];
}

export class AuditComplianceService {
  /**
   * Log comprehensive audit trail entry
   */
  async logAuditEvent(entry: AuditTrailEntry): Promise<void> {
    try {
      // Calculate retention date based on compliance level
      const retentionDate = this.calculateRetentionDate(entry.complianceLevel);

      // Create audit log entry with enhanced metadata
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          documentId: entry.documentId,
          action: entry.action,
          details: entry.details,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          complianceLevel: entry.complianceLevel,
          retentionDate,
          // Store additional metadata in a structured format
          metadata: {
            timestamp: new Date().toISOString(),
            sessionId: crypto.randomBytes(16).toString('hex'),
            requestId: crypto.randomUUID(),
            ...entry.metadata,
          },
        },
      });

      logger.info(`Audit event logged: ${entry.action} for ${entry.userId || 'anonymous'}`);

      // Trigger compliance monitoring for critical actions
      const criticalActions = [
        'DOCUMENT_UPLOADED',
        'DOCUMENT_SIGNED',
        'DOCUMENT_DELETED',
        'PERMISSION_CHANGED',
        'DATA_EXPORT',
      ];

      if (criticalActions.includes(entry.action)) {
        await this.triggerComplianceMonitoring(entry);
      }

    } catch (error) {
      logger.error('Failed to log audit event:', error);
      throw new Error('Audit logging failed');
    }
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(
    framework: 'HIPAA' | 'SOX' | 'GDPR' | 'SOC2' | 'ALL',
    startDate: Date,
    endDate: Date,
    generatedBy: string
  ): Promise<ComplianceReport> {
    try {
      const reportId = crypto.randomUUID();
      logger.info(`Generating compliance report: ${framework} (${reportId})`);

      // Get relevant documents and audit logs
      const [documents, auditLogs, users] = await Promise.all([
        this.getDocumentsForCompliance(framework, startDate, endDate),
        this.getAuditLogsForCompliance(framework, startDate, endDate),
        this.getUsersForCompliance(framework, startDate, endDate),
      ]);

      // Analyze compliance status
      const findings = await this.analyzeCompliance(framework, documents, auditLogs, users);
      const summary = this.calculateComplianceSummary(documents, findings);
      const recommendations = this.generateComplianceRecommendations(framework, findings);
      const certificationStatus = this.determineCertificationStatus(summary, findings);

      const report: ComplianceReport = {
        reportId,
        generatedAt: new Date(),
        generatedBy,
        timeRange: { start: startDate, end: endDate },
        complianceFramework: framework,
        summary,
        findings,
        recommendations,
        certificationStatus,
      };

      // Store report in database for audit purposes
      await prisma.complianceReport.create({
        data: {
          id: reportId,
          framework,
          generatedBy,
          timeRangeStart: startDate,
          timeRangeEnd: endDate,
          summary: JSON.stringify(summary),
          findings: JSON.stringify(findings),
          recommendations,
          certificationStatus,
          reportData: JSON.stringify(report),
        },
      });

      logger.info(`Compliance report generated: ${reportId} (${certificationStatus})`);
      return report;

    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw new Error('Compliance report generation failed');
    }
  }

  /**
   * Validate access control for specific action
   */
  async validateAccess(
    userId: string,
    resource: string,
    action: string,
    context: any = {}
  ): Promise<{
    allowed: boolean;
    reason?: string;
    policies: string[];
    conditions: any[];
  }> {
    try {
      // Get user and their roles
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: true },
      });

      if (!user) {
        return {
          allowed: false,
          reason: 'User not found',
          policies: [],
          conditions: [],
        };
      }

      // Get applicable access control policies
      const policies = await this.getApplicablePolicies(user, resource, action);
      
      // Evaluate policies and conditions
      const accessResult = await this.evaluateAccessPolicies(policies, user, resource, action, context);

      // Log access attempt
      await this.logAuditEvent({
        userId,
        action: `ACCESS_${accessResult.allowed ? 'GRANTED' : 'DENIED'}`,
        details: `Access ${accessResult.allowed ? 'granted' : 'denied'} for ${action} on ${resource}`,
        ipAddress: context.ipAddress || 'unknown',
        userAgent: context.userAgent || 'unknown',
        metadata: {
          resource,
          action,
          policies: accessResult.policies,
          reason: accessResult.reason,
        },
      });

      return accessResult;

    } catch (error) {
      logger.error('Access validation failed:', error);
      return {
        allowed: false,
        reason: 'Access validation error',
        policies: [],
        conditions: [],
      };
    }
  }

  /**
   * Monitor for compliance violations in real-time
   */
  async monitorComplianceViolations(): Promise<ComplianceFinding[]> {
    try {
      const violations: ComplianceFinding[] = [];
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Check for various compliance violations
      const checks = [
        this.checkDataRetentionViolations(),
        this.checkAccessPatternAnomalies(last24Hours, now),
        this.checkEncryptionCompliance(),
        this.checkAuditTrailIntegrity(last24Hours, now),
        this.checkSignatureCompliance(),
        this.checkDataExportCompliance(last24Hours, now),
      ];

      const results = await Promise.allSettled(checks);
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          violations.push(...result.value);
        } else {
          logger.warn('Compliance check failed:', result.reason);
        }
      });

      // Sort by severity
      violations.sort((a, b) => {
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

      // Alert on critical violations
      const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
      if (criticalViolations.length > 0) {
        await this.alertCriticalViolations(criticalViolations);
      }

      return violations;

    } catch (error) {
      logger.error('Compliance monitoring failed:', error);
      return [];
    }
  }

  /**
   * Get compliance dashboard data
   */
  async getComplianceDashboard(
    framework?: string,
    timeRange: 'day' | 'week' | 'month' | 'quarter' = 'month'
  ): Promise<{
    overview: any;
    metrics: any;
    trends: any;
    alerts: any;
    documents: any;
  }> {
    try {
      const endDate = new Date();
      const startDate = this.getStartDateForRange(timeRange);

      // Get compliance metrics
      const [
        totalDocuments,
        compliantDocuments,
        auditEvents,
        violations,
        documentsByCompliance,
        accessEvents,
      ] = await Promise.all([
        this.getDocumentCount(framework, startDate, endDate),
        this.getCompliantDocumentCount(framework, startDate, endDate),
        this.getAuditEventCount(framework, startDate, endDate),
        this.monitorComplianceViolations(),
        this.getDocumentsByComplianceLevel(framework, startDate, endDate),
        this.getAccessEventCount(framework, startDate, endDate),
      ]);

      const complianceScore = totalDocuments > 0 
        ? Math.round((compliantDocuments / totalDocuments) * 100)
        : 100;

      const overview = {
        complianceScore,
        totalDocuments,
        compliantDocuments,
        violations: violations.length,
        criticalViolations: violations.filter(v => v.severity === 'CRITICAL').length,
        lastUpdated: new Date(),
      };

      const metrics = {
        auditEvents,
        accessEvents,
        documentsByCompliance,
        violationsByType: this.groupViolationsByType(violations),
        trends: await this.getComplianceTrends(framework, startDate, endDate),
      };

      const alerts = {
        active: violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH'),
        recentViolations: violations.slice(0, 10),
        pendingRemediation: violations.filter(v => v.remediation.required),
      };

      return {
        overview,
        metrics,
        trends: await this.getComplianceTrends(framework, startDate, endDate),
        alerts,
        documents: documentsByCompliance,
      };

    } catch (error) {
      logger.error('Failed to get compliance dashboard:', error);
      throw new Error('Compliance dashboard failed');
    }
  }

  /**
   * Private helper methods
   */
  private calculateRetentionDate(complianceLevel?: string): Date {
    const baseRetention = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years default
    
    const retentionPeriods = {
      'HIPAA': 6 * 365 * 24 * 60 * 60 * 1000, // 6 years
      'SOX': 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
      'GDPR': 3 * 365 * 24 * 60 * 60 * 1000, // 3 years
      'HIGH_SECURITY': 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
    };

    const retention = complianceLevel ? retentionPeriods[complianceLevel as keyof typeof retentionPeriods] || baseRetention : baseRetention;
    return new Date(Date.now() + retention);
  }

  private async triggerComplianceMonitoring(entry: AuditTrailEntry): Promise<void> {
    // Trigger real-time compliance checks for critical actions
    logger.info(`Triggering compliance monitoring for: ${entry.action}`);
    
    // This would integrate with external compliance monitoring systems
    // For now, we'll just flag for review
    if (entry.complianceLevel && ['HIPAA', 'SOX', 'GDPR'].includes(entry.complianceLevel)) {
      // Schedule compliance review
      await this.scheduleComplianceReview(entry);
    }
  }

  private async scheduleComplianceReview(entry: AuditTrailEntry): Promise<void> {
    // Schedule automated compliance review
    logger.info(`Scheduled compliance review for: ${entry.action}`);
  }

  private async getDocumentsForCompliance(
    framework: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const where: any = {
      createdAt: { gte: startDate, lte: endDate },
    };

    if (framework !== 'ALL') {
      where.complianceLevel = framework;
    }

    return await prisma.document.findMany({
      where,
      include: {
        signatures: true,
        storageProofs: true,
        auditLogs: true,
      },
    });
  }

  private async getAuditLogsForCompliance(
    framework: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const where: any = {
      timestamp: { gte: startDate, lte: endDate },
    };

    if (framework !== 'ALL') {
      where.complianceLevel = framework;
    }

    return await prisma.auditLog.findMany({
      where,
      include: { user: true, document: true },
      orderBy: { timestamp: 'desc' },
    });
  }

  private async getUsersForCompliance(
    framework: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return await prisma.user.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { auditLogs: true },
    });
  }

  private async analyzeCompliance(
    framework: string,
    documents: any[],
    auditLogs: any[],
    users: any[]
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Framework-specific compliance checks
    switch (framework) {
      case 'HIPAA':
        findings.push(...await this.analyzeHIPAACompliance(documents, auditLogs));
        break;
      case 'SOX':
        findings.push(...await this.analyzeSOXCompliance(documents, auditLogs));
        break;
      case 'GDPR':
        findings.push(...await this.analyzeGDPRCompliance(documents, auditLogs, users));
        break;
      case 'SOC2':
        findings.push(...await this.analyzeSOC2Compliance(documents, auditLogs));
        break;
      case 'ALL':
        findings.push(...await this.analyzeHIPAACompliance(documents, auditLogs));
        findings.push(...await this.analyzeSOXCompliance(documents, auditLogs));
        findings.push(...await this.analyzeGDPRCompliance(documents, auditLogs, users));
        findings.push(...await this.analyzeSOC2Compliance(documents, auditLogs));
        break;
    }

    return findings;
  }

  private async analyzeHIPAACompliance(documents: any[], auditLogs: any[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check encryption requirements
    const unencryptedDocs = documents.filter(doc => !doc.isEncrypted);
    if (unencryptedDocs.length > 0) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'VIOLATION',
        severity: 'HIGH',
        category: 'Encryption',
        description: 'HIPAA requires encryption of PHI data at rest',
        affected: {
          documents: unencryptedDocs.map(doc => doc.id),
          users: [],
          systems: ['document-storage'],
        },
        evidence: unencryptedDocs,
        remediation: {
          required: true,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          steps: ['Enable encryption for all documents', 'Migrate existing documents to encrypted storage'],
          responsible: 'Security Team',
        },
      });
    }

    // Check audit trail completeness
    const requiredEvents = ['DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED', 'DOCUMENT_DOWNLOADED'];
    const missingEvents = requiredEvents.filter(event => 
      !auditLogs.some(log => log.action === event)
    );

    if (missingEvents.length > 0) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'WARNING',
        severity: 'MEDIUM',
        category: 'Audit Trail',
        description: 'Incomplete audit trail for HIPAA compliance',
        affected: {
          documents: [],
          users: [],
          systems: ['audit-system'],
        },
        evidence: missingEvents,
        remediation: {
          required: true,
          steps: ['Enhance audit logging', 'Implement missing event tracking'],
          responsible: 'Development Team',
        },
      });
    }

    return findings;
  }

  private async analyzeSOXCompliance(documents: any[], auditLogs: any[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check for financial document signatures
    const financialDocs = documents.filter(doc => 
      doc.title.toLowerCase().includes('financial') || 
      doc.complianceLevel === 'SOX'
    );

    const unsignedFinancialDocs = financialDocs.filter(doc => doc.signatures.length === 0);
    if (unsignedFinancialDocs.length > 0) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'VIOLATION',
        severity: 'HIGH',
        category: 'Digital Signatures',
        description: 'SOX requires digital signatures on financial documents',
        affected: {
          documents: unsignedFinancialDocs.map(doc => doc.id),
          users: [],
          systems: ['document-signing'],
        },
        evidence: unsignedFinancialDocs,
        remediation: {
          required: true,
          deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          steps: ['Implement mandatory signing workflow', 'Obtain required signatures'],
          responsible: 'Finance Team',
        },
      });
    }

    return findings;
  }

  private async analyzeGDPRCompliance(documents: any[], auditLogs: any[], users: any[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check data retention periods
    const gdprDocs = documents.filter(doc => doc.complianceLevel === 'GDPR');
    const overdueRetention = gdprDocs.filter(doc => {
      const age = Date.now() - new Date(doc.createdAt).getTime();
      const maxRetention = 3 * 365 * 24 * 60 * 60 * 1000; // 3 years for GDPR
      return age > maxRetention;
    });

    if (overdueRetention.length > 0) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'VIOLATION',
        severity: 'HIGH',
        category: 'Data Retention',
        description: 'GDPR requires deletion of personal data after retention period',
        affected: {
          documents: overdueRetention.map(doc => doc.id),
          users: [],
          systems: ['data-retention'],
        },
        evidence: overdueRetention,
        remediation: {
          required: true,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          steps: ['Review data necessity', 'Delete or anonymize overdue data'],
          responsible: 'Data Protection Officer',
        },
      });
    }

    return findings;
  }

  private async analyzeSOC2Compliance(documents: any[], auditLogs: any[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check access controls
    const suspiciousAccess = auditLogs.filter(log => 
      log.action === 'DOCUMENT_VIEWED' && 
      new Date(log.timestamp).getHours() < 6 || new Date(log.timestamp).getHours() > 22
    );

    if (suspiciousAccess.length > 10) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'WARNING',
        severity: 'MEDIUM',
        category: 'Access Controls',
        description: 'Unusual access patterns detected outside business hours',
        affected: {
          documents: suspiciousAccess.map(log => log.documentId).filter(Boolean),
          users: suspiciousAccess.map(log => log.userId).filter(Boolean),
          systems: ['access-control'],
        },
        evidence: suspiciousAccess,
        remediation: {
          required: false,
          steps: ['Review access policies', 'Implement time-based access controls'],
          responsible: 'Security Team',
        },
      });
    }

    return findings;
  }

  private calculateComplianceSummary(documents: any[], findings: ComplianceFinding[]): any {
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL').length;
    const highFindings = findings.filter(f => f.severity === 'HIGH').length;
    const violationFindings = findings.filter(f => f.type === 'VIOLATION').length;

    const complianceScore = Math.max(0, 100 - (criticalFindings * 25) - (highFindings * 10) - (violationFindings * 5));
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (criticalFindings > 0) riskLevel = 'CRITICAL';
    else if (highFindings > 2) riskLevel = 'HIGH';
    else if (violationFindings > 0) riskLevel = 'MEDIUM';

    return {
      totalDocuments: documents.length,
      compliantDocuments: documents.length - violationFindings,
      nonCompliantDocuments: violationFindings,
      complianceScore,
      riskLevel,
    };
  }

  private generateComplianceRecommendations(framework: string, findings: ComplianceFinding[]): string[] {
    const recommendations: string[] = [];

    if (findings.length === 0) {
      recommendations.push('Compliance status is good. Continue monitoring.');
      return recommendations;
    }

    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const violationCount = findings.filter(f => f.type === 'VIOLATION').length;

    if (criticalCount > 0) {
      recommendations.push('Address critical violations immediately to avoid compliance penalties');
    }

    if (violationCount > 0) {
      recommendations.push('Implement remediation plans for all violations within specified deadlines');
    }

    // Framework-specific recommendations
    switch (framework) {
      case 'HIPAA':
        recommendations.push('Consider implementing additional encryption measures');
        recommendations.push('Enhance audit trail completeness for all PHI access');
        break;
      case 'SOX':
        recommendations.push('Strengthen financial document approval workflows');
        recommendations.push('Implement segregation of duties for financial processes');
        break;
      case 'GDPR':
        recommendations.push('Review and update data retention policies');
        recommendations.push('Implement data subject rights management');
        break;
      case 'SOC2':
        recommendations.push('Enhance access control monitoring');
        recommendations.push('Implement automated compliance monitoring');
        break;
    }

    return recommendations;
  }

  private determineCertificationStatus(summary: any, findings: ComplianceFinding[]): 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' {
    const violations = findings.filter(f => f.type === 'VIOLATION').length;
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL').length;

    if (criticalFindings > 0 || violations > 3) {
      return 'NON_COMPLIANT';
    }

    if (violations > 0 || summary.complianceScore < 85) {
      return 'NEEDS_REVIEW';
    }

    return 'COMPLIANT';
  }

  // Additional helper methods for dashboard and monitoring
  private async getApplicablePolicies(user: any, resource: string, action: string): Promise<AccessControlPolicy[]> {
    // Placeholder for access control policy retrieval
    return [];
  }

  private async evaluateAccessPolicies(
    policies: AccessControlPolicy[],
    user: any,
    resource: string,
    action: string,
    context: any
  ): Promise<any> {
    // Placeholder for policy evaluation logic
    return {
      allowed: true,
      policies: [],
      conditions: [],
    };
  }

  private getStartDateForRange(range: string): Date {
    const now = new Date();
    switch (range) {
      case 'day': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'quarter': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  // Placeholder methods for various compliance checks
  private async checkDataRetentionViolations(): Promise<ComplianceFinding[]> { return []; }
  private async checkAccessPatternAnomalies(start: Date, end: Date): Promise<ComplianceFinding[]> { return []; }
  private async checkEncryptionCompliance(): Promise<ComplianceFinding[]> { return []; }
  private async checkAuditTrailIntegrity(start: Date, end: Date): Promise<ComplianceFinding[]> { return []; }
  private async checkSignatureCompliance(): Promise<ComplianceFinding[]> { return []; }
  private async checkDataExportCompliance(start: Date, end: Date): Promise<ComplianceFinding[]> { return []; }
  private async alertCriticalViolations(violations: ComplianceFinding[]): Promise<void> { }
  private async getDocumentCount(framework?: string, start?: Date, end?: Date): Promise<number> { return 0; }
  private async getCompliantDocumentCount(framework?: string, start?: Date, end?: Date): Promise<number> { return 0; }
  private async getAuditEventCount(framework?: string, start?: Date, end?: Date): Promise<number> { return 0; }
  private async getDocumentsByComplianceLevel(framework?: string, start?: Date, end?: Date): Promise<any> { return {}; }
  private async getAccessEventCount(framework?: string, start?: Date, end?: Date): Promise<number> { return 0; }
  private async getComplianceTrends(framework?: string, start?: Date, end?: Date): Promise<any> { return []; }
  private groupViolationsByType(violations: ComplianceFinding[]): any { return {}; }
}

export const auditComplianceService = new AuditComplianceService();
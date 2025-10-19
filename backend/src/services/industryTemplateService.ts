import { PrismaClient } from '@prisma/client';
import {
  IndustryTemplate,
  IndustryType,
  TemplateType,
  ComplianceLevel,
  FieldType,
  WorkflowAction,
} from '../../../shared/src/types';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class IndustryTemplateService {
  /**
   * Initialize default templates for law firms and healthcare
   */
  async initializeDefaultTemplates(): Promise<void> {
    const templates = [
      // Law Firm Templates
      {
        industryType: 'LAW_FIRM' as IndustryType,
        name: 'Legal Services Agreement',
        description: 'Standard legal services agreement for client engagement',
        templateType: 'LEGAL_CONTRACT' as TemplateType,
        complianceLevel: 'STANDARD' as ComplianceLevel,
        estimatedCompletionTime: 15,
        documentFields: JSON.stringify([
          { name: 'clientName', label: 'Client Full Name', type: 'TEXT', required: true },
          { name: 'clientEmail', label: 'Client Email', type: 'EMAIL', required: true },
          { name: 'caseType', label: 'Case Type', type: 'SELECT', required: true, options: ['Civil', 'Criminal', 'Corporate', 'Family Law', 'Real Estate'] },
          { name: 'retainerAmount', label: 'Retainer Amount', type: 'NUMBER', required: true },
          { name: 'scopeOfWork', label: 'Scope of Work', type: 'TEXTAREA', required: true },
          { name: 'effectiveDate', label: 'Effective Date', type: 'DATE', required: true },
          { name: 'attorneySignature', label: 'Attorney Signature', type: 'SIGNATURE', required: true },
          { name: 'clientSignature', label: 'Client Signature', type: 'SIGNATURE', required: true },
        ]),
        workflowSteps: JSON.stringify([
          { order: 1, name: 'Attorney Review', description: 'Attorney reviews and fills the agreement', assignedRole: 'Attorney', action: 'REVIEW', autoAdvance: false, estimatedDuration: 10 },
          { order: 2, name: 'Client Review', description: 'Client reviews the agreement', assignedRole: 'Client', action: 'REVIEW', autoAdvance: false, estimatedDuration: 15 },
          { order: 3, name: 'Attorney Signature', description: 'Attorney signs the agreement', assignedRole: 'Attorney', action: 'SIGN', autoAdvance: true, estimatedDuration: 2 },
          { order: 4, name: 'Client Signature', description: 'Client signs the agreement', assignedRole: 'Client', action: 'SIGN', autoAdvance: true, estimatedDuration: 2 },
          { order: 5, name: 'Archive', description: 'Archive signed agreement', assignedRole: 'System', action: 'ARCHIVE', autoAdvance: true, estimatedDuration: 1 },
        ]),
      },
      {
        industryType: 'LAW_FIRM' as IndustryType,
        name: 'Non-Disclosure Agreement (NDA)',
        description: 'Mutual or one-way NDA for confidential information',
        templateType: 'NDA' as TemplateType,
        complianceLevel: 'STANDARD' as ComplianceLevel,
        estimatedCompletionTime: 10,
        documentFields: JSON.stringify([
          { name: 'party1Name', label: 'Disclosing Party Name', type: 'TEXT', required: true },
          { name: 'party2Name', label: 'Receiving Party Name', type: 'TEXT', required: true },
          { name: 'ndaType', label: 'NDA Type', type: 'SELECT', required: true, options: ['Mutual', 'One-Way'] },
          { name: 'purposeOfDisclosure', label: 'Purpose of Disclosure', type: 'TEXTAREA', required: true },
          { name: 'termDuration', label: 'Term Duration (years)', type: 'NUMBER', required: true },
          { name: 'effectiveDate', label: 'Effective Date', type: 'DATE', required: true },
          { name: 'party1Signature', label: 'Party 1 Signature', type: 'SIGNATURE', required: true },
          { name: 'party2Signature', label: 'Party 2 Signature', type: 'SIGNATURE', required: true },
        ]),
        workflowSteps: JSON.stringify([
          { order: 1, name: 'Draft Review', description: 'Review NDA terms', assignedRole: 'Legal Team', action: 'REVIEW', autoAdvance: false, estimatedDuration: 5 },
          { order: 2, name: 'Party 1 Signature', description: 'First party signs', assignedRole: 'Party 1', action: 'SIGN', autoAdvance: true, estimatedDuration: 2 },
          { order: 3, name: 'Party 2 Signature', description: 'Second party signs', assignedRole: 'Party 2', action: 'SIGN', autoAdvance: true, estimatedDuration: 2 },
          { order: 4, name: 'Final Verification', description: 'Verify all signatures', assignedRole: 'Legal Team', action: 'VERIFY', autoAdvance: true, estimatedDuration: 1 },
          { order: 5, name: 'Archive', description: 'Archive signed NDA', assignedRole: 'System', action: 'ARCHIVE', autoAdvance: true, estimatedDuration: 1 },
        ]),
      },
      // Healthcare Templates
      {
        industryType: 'HEALTHCARE' as IndustryType,
        name: 'Patient Consent Form',
        description: 'General patient consent for medical treatment',
        templateType: 'PATIENT_CONSENT' as TemplateType,
        complianceLevel: 'HIPAA' as ComplianceLevel,
        estimatedCompletionTime: 8,
        documentFields: JSON.stringify([
          { name: 'patientName', label: 'Patient Full Name', type: 'TEXT', required: true },
          { name: 'dateOfBirth', label: 'Date of Birth', type: 'DATE', required: true },
          { name: 'patientEmail', label: 'Patient Email', type: 'EMAIL', required: false },
          { name: 'patientPhone', label: 'Patient Phone', type: 'PHONE', required: true },
          { name: 'treatmentType', label: 'Type of Treatment', type: 'TEXTAREA', required: true },
          { name: 'riskAcknowledgment', label: 'I acknowledge the risks', type: 'CHECKBOX', required: true },
          { name: 'consentDate', label: 'Consent Date', type: 'DATE', required: true },
          { name: 'patientSignature', label: 'Patient Signature', type: 'SIGNATURE', required: true },
          { name: 'witnessSignature', label: 'Witness Signature', type: 'SIGNATURE', required: false },
        ]),
        workflowSteps: JSON.stringify([
          { order: 1, name: 'Patient Information', description: 'Patient fills in personal information', assignedRole: 'Patient', action: 'REVIEW', autoAdvance: false, estimatedDuration: 5 },
          { order: 2, name: 'Healthcare Provider Review', description: 'Provider reviews consent form', assignedRole: 'Healthcare Provider', action: 'REVIEW', autoAdvance: false, estimatedDuration: 3 },
          { order: 3, name: 'Patient Signature', description: 'Patient signs consent', assignedRole: 'Patient', action: 'SIGN', autoAdvance: true, estimatedDuration: 2 },
          { order: 4, name: 'Witness Signature', description: 'Witness signs (if required)', assignedRole: 'Witness', action: 'SIGN', autoAdvance: true, estimatedDuration: 1 },
          { order: 5, name: 'HIPAA Compliance Check', description: 'Verify HIPAA compliance', assignedRole: 'Compliance Officer', action: 'VERIFY', autoAdvance: true, estimatedDuration: 2 },
          { order: 6, name: 'Archive', description: 'Archive in patient records', assignedRole: 'System', action: 'ARCHIVE', autoAdvance: true, estimatedDuration: 1 },
        ]),
      },
      {
        industryType: 'HEALTHCARE' as IndustryType,
        name: 'HIPAA Authorization Form',
        description: 'Authorization for use and disclosure of protected health information',
        templateType: 'HIPAA_AUTHORIZATION' as TemplateType,
        complianceLevel: 'HIPAA' as ComplianceLevel,
        estimatedCompletionTime: 10,
        documentFields: JSON.stringify([
          { name: 'patientName', label: 'Patient Full Name', type: 'TEXT', required: true },
          { name: 'dateOfBirth', label: 'Date of Birth', type: 'DATE', required: true },
          { name: 'authorizedPersons', label: 'Authorized Persons/Organizations', type: 'TEXTAREA', required: true },
          { name: 'informationToDisclose', label: 'Information to be Disclosed', type: 'MULTISELECT', required: true, options: ['Medical History', 'Lab Results', 'Treatment Records', 'Prescription Information', 'Mental Health Records'] },
          { name: 'purposeOfDisclosure', label: 'Purpose of Disclosure', type: 'TEXTAREA', required: true },
          { name: 'expirationDate', label: 'Authorization Expiration Date', type: 'DATE', required: true },
          { name: 'rightToRevoke', label: 'I understand my right to revoke', type: 'CHECKBOX', required: true },
          { name: 'patientSignature', label: 'Patient/Representative Signature', type: 'SIGNATURE', required: true },
        ]),
        workflowSteps: JSON.stringify([
          { order: 1, name: 'Form Completion', description: 'Patient completes authorization form', assignedRole: 'Patient', action: 'REVIEW', autoAdvance: false, estimatedDuration: 8 },
          { order: 2, name: 'HIPAA Officer Review', description: 'HIPAA compliance officer reviews', assignedRole: 'HIPAA Officer', action: 'REVIEW', autoAdvance: false, estimatedDuration: 5 },
          { order: 3, name: 'Patient Signature', description: 'Patient signs authorization', assignedRole: 'Patient', action: 'SIGN', autoAdvance: true, estimatedDuration: 2 },
          { order: 4, name: 'Compliance Verification', description: 'Final HIPAA compliance check', assignedRole: 'Compliance Officer', action: 'VERIFY', autoAdvance: true, estimatedDuration: 3 },
          { order: 5, name: 'Archive', description: 'Archive in secure storage', assignedRole: 'System', action: 'ARCHIVE', autoAdvance: true, estimatedDuration: 1 },
        ]),
      },
      {
        industryType: 'HEALTHCARE' as IndustryType,
        name: 'Telemedicine Consent Form',
        description: 'Patient consent for telemedicine services',
        templateType: 'PATIENT_CONSENT' as TemplateType,
        complianceLevel: 'HIPAA' as ComplianceLevel,
        estimatedCompletionTime: 7,
        documentFields: JSON.stringify([
          { name: 'patientName', label: 'Patient Full Name', type: 'TEXT', required: true },
          { name: 'patientEmail', label: 'Patient Email', type: 'EMAIL', required: true },
          { name: 'patientPhone', label: 'Patient Phone', type: 'PHONE', required: true },
          { name: 'understandLimitations', label: 'I understand telemedicine limitations', type: 'CHECKBOX', required: true },
          { name: 'consentToRecording', label: 'I consent to session recording (if applicable)', type: 'CHECKBOX', required: false },
          { name: 'privacyAcknowledgment', label: 'I acknowledge privacy policies', type: 'CHECKBOX', required: true },
          { name: 'emergencyContact', label: 'Emergency Contact', type: 'TEXT', required: true },
          { name: 'patientSignature', label: 'Patient Signature', type: 'SIGNATURE', required: true },
        ]),
        workflowSteps: JSON.stringify([
          { order: 1, name: 'Patient Review', description: 'Patient reviews telemedicine consent', assignedRole: 'Patient', action: 'REVIEW', autoAdvance: false, estimatedDuration: 5 },
          { order: 2, name: 'Patient Signature', description: 'Patient signs consent', assignedRole: 'Patient', action: 'SIGN', autoAdvance: true, estimatedDuration: 2 },
          { order: 3, name: 'Healthcare Verification', description: 'Provider verifies consent', assignedRole: 'Healthcare Provider', action: 'VERIFY', autoAdvance: true, estimatedDuration: 2 },
          { order: 4, name: 'Archive', description: 'Archive in patient portal', assignedRole: 'System', action: 'ARCHIVE', autoAdvance: true, estimatedDuration: 1 },
        ]),
      },
    ];

    for (const template of templates) {
      try {
        await prisma.industryTemplate.upsert({
          where: {
            industryType_name: {
              industryType: template.industryType,
              name: template.name,
            },
          },
          update: template,
          create: template,
        });
        logger.info(`Template initialized: ${template.name}`);
      } catch (error) {
        logger.error(`Error initializing template ${template.name}:`, error);
      }
    }
  }

  /**
   * Get templates by industry type
   */
  async getTemplatesByIndustry(industryType: IndustryType): Promise<IndustryTemplate[]> {
    try {
      const templates = await prisma.industryTemplate.findMany({
        where: {
          industryType,
          isActive: true,
        },
        orderBy: {
          usageCount: 'desc',
        },
      });

      return templates.map((t) => this.formatTemplate(t));
    } catch (error) {
      logger.error('Error getting templates by industry:', error);
      throw new Error('Failed to get industry templates');
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<IndustryTemplate | null> {
    try {
      const template = await prisma.industryTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) return null;
      return this.formatTemplate(template);
    } catch (error) {
      logger.error('Error getting template:', error);
      throw new Error('Failed to get template');
    }
  }

  /**
   * Create custom template
   */
  async createTemplate(data: {
    industryType: IndustryType;
    name: string;
    description: string;
    templateType: TemplateType;
    documentFields: any[];
    workflowSteps: any[];
    complianceLevel: ComplianceLevel;
    estimatedCompletionTime: number;
  }): Promise<IndustryTemplate> {
    try {
      const template = await prisma.industryTemplate.create({
        data: {
          ...data,
          documentFields: JSON.stringify(data.documentFields),
          workflowSteps: JSON.stringify(data.workflowSteps),
        },
      });

      logger.info(`Custom template created: ${template.name}`);
      return this.formatTemplate(template);
    } catch (error) {
      logger.error('Error creating template:', error);
      throw new Error('Failed to create template');
    }
  }

  /**
   * Increment template usage count
   */
  async incrementUsage(templateId: string): Promise<void> {
    try {
      await prisma.industryTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });
    } catch (error) {
      logger.error('Error incrementing template usage:', error);
    }
  }

  /**
   * Get popular templates
   */
  async getPopularTemplates(limit: number = 10): Promise<IndustryTemplate[]> {
    try {
      const templates = await prisma.industryTemplate.findMany({
        where: { isActive: true },
        orderBy: {
          usageCount: 'desc',
        },
        take: limit,
      });

      return templates.map((t) => this.formatTemplate(t));
    } catch (error) {
      logger.error('Error getting popular templates:', error);
      throw new Error('Failed to get popular templates');
    }
  }

  /**
   * Search templates
   */
  async searchTemplates(query: string): Promise<IndustryTemplate[]> {
    try {
      const templates = await prisma.industryTemplate.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: {
          usageCount: 'desc',
        },
      });

      return templates.map((t) => this.formatTemplate(t));
    } catch (error) {
      logger.error('Error searching templates:', error);
      throw new Error('Failed to search templates');
    }
  }

  /**
   * Format template for response
   */
  private formatTemplate(template: any): IndustryTemplate {
    return {
      ...template,
      documentFields: JSON.parse(template.documentFields || '[]'),
      workflowSteps: JSON.parse(template.workflowSteps || '[]'),
    };
  }
}

export const industryTemplateService = new IndustryTemplateService();

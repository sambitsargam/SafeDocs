import { PrismaClient } from '@prisma/client';
import {
  PilotProgram,
  PilotParticipant,
  PilotFeedback,
  PilotAnalytics,
  PilotStatus,
  IndustryType,
  PilotGoal,
  CompanySize,
  FeedbackCategory,
} from '../../../shared/src/types';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class PilotProgramService {
  /**
   * Create a new pilot program application
   */
  async createPilotProgram(data: {
    organizationName: string;
    industryType: IndustryType;
    contactPerson: string;
    contactEmail: string;
    contactPhone?: string;
    companySize: CompanySize;
    currentSolution?: string;
    estimatedDocumentVolume: number;
    goals: PilotGoal[];
    specialRequirements?: string;
    complianceNeeds: string[];
  }): Promise<PilotProgram> {
    try {
      const program = await prisma.pilotProgram.create({
        data: {
          ...data,
          goals: JSON.stringify(data.goals),
          complianceNeeds: JSON.stringify(data.complianceNeeds),
          status: 'PENDING',
        },
      });

      logger.info(`Pilot program created: ${program.id} for ${data.organizationName}`);
      return this.formatPilotProgram(program);
    } catch (error) {
      logger.error('Error creating pilot program:', error);
      throw new Error('Failed to create pilot program');
    }
  }

  /**
   * Approve a pilot program
   */
  async approvePilotProgram(
    programId: string,
    approvedBy: string,
    startDate: Date,
    endDate: Date
  ): Promise<PilotProgram> {
    try {
      const program = await prisma.pilotProgram.update({
        where: { id: programId },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvedAt: new Date(),
          startDate,
          endDate,
        },
      });

      logger.info(`Pilot program approved: ${programId}`);
      return this.formatPilotProgram(program);
    } catch (error) {
      logger.error('Error approving pilot program:', error);
      throw new Error('Failed to approve pilot program');
    }
  }

  /**
   * Start a pilot program
   */
  async startPilotProgram(programId: string): Promise<PilotProgram> {
    try {
      const program = await prisma.pilotProgram.update({
        where: { id: programId },
        data: {
          status: 'ACTIVE',
        },
      });

      // Initialize analytics
      await this.initializePilotAnalytics(programId);

      logger.info(`Pilot program started: ${programId}`);
      return this.formatPilotProgram(program);
    } catch (error) {
      logger.error('Error starting pilot program:', error);
      throw new Error('Failed to start pilot program');
    }
  }

  /**
   * Add participant to pilot program
   */
  async addParticipant(data: {
    pilotProgramId: string;
    userId: string;
    role: string;
    department?: string;
  }): Promise<PilotParticipant> {
    try {
      const participant = await prisma.pilotParticipant.create({
        data: {
          ...data,
          usageStats: JSON.stringify({
            documentsUploaded: 0,
            documentsSigned: 0,
            verificationsPerformed: 0,
            totalStorageUsed: 0,
            averageSigningTime: 0,
            collaborationCount: 0,
            lastActivity: new Date(),
          }),
        },
        include: {
          user: true,
          program: true,
        },
      });

      logger.info(`Participant added to pilot ${data.pilotProgramId}: ${data.userId}`);
      return this.formatParticipant(participant);
    } catch (error) {
      logger.error('Error adding participant:', error);
      throw new Error('Failed to add participant');
    }
  }

  /**
   * Update participant usage statistics
   */
  async updateParticipantStats(
    participantId: string,
    stats: Partial<{
      documentsUploaded: number;
      documentsSigned: number;
      verificationsPerformed: number;
      totalStorageUsed: number;
      averageSigningTime: number;
      collaborationCount: number;
    }>
  ): Promise<void> {
    try {
      const participant = await prisma.pilotParticipant.findUnique({
        where: { id: participantId },
      });

      if (!participant) {
        throw new Error('Participant not found');
      }

      const currentStats = JSON.parse(participant.usageStats as string);
      const updatedStats = {
        ...currentStats,
        ...stats,
        lastActivity: new Date(),
      };

      await prisma.pilotParticipant.update({
        where: { id: participantId },
        data: {
          usageStats: JSON.stringify(updatedStats),
        },
      });

      logger.info(`Updated stats for participant: ${participantId}`);
    } catch (error) {
      logger.error('Error updating participant stats:', error);
      throw new Error('Failed to update participant stats');
    }
  }

  /**
   * Submit feedback for pilot program
   */
  async submitFeedback(data: {
    pilotProgramId: string;
    participantId: string;
    category: FeedbackCategory;
    rating: number;
    feedback: string;
    suggestedImprovements?: string;
    wouldRecommend: boolean;
    isPublic?: boolean;
  }): Promise<PilotFeedback> {
    try {
      if (data.rating < 1 || data.rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const feedbackRecord = await prisma.pilotFeedback.create({
        data,
      });

      // Update analytics based on feedback
      await this.updateAnalyticsFromFeedback(data.pilotProgramId);

      logger.info(`Feedback submitted for pilot ${data.pilotProgramId}`);
      return feedbackRecord as any;
    } catch (error) {
      logger.error('Error submitting feedback:', error);
      throw new Error('Failed to submit feedback');
    }
  }

  /**
   * Get pilot program by ID
   */
  async getPilotProgram(programId: string): Promise<PilotProgram | null> {
    try {
      const program = await prisma.pilotProgram.findUnique({
        where: { id: programId },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
          feedback: true,
          analytics: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!program) return null;
      return this.formatPilotProgram(program);
    } catch (error) {
      logger.error('Error getting pilot program:', error);
      throw new Error('Failed to get pilot program');
    }
  }

  /**
   * List pilot programs
   */
  async listPilotPrograms(filters?: {
    status?: PilotStatus;
    industryType?: IndustryType;
    limit?: number;
    offset?: number;
  }): Promise<{ programs: PilotProgram[]; total: number }> {
    try {
      const where: any = {};
      if (filters?.status) where.status = filters.status;
      if (filters?.industryType) where.industryType = filters.industryType;

      const [programs, total] = await Promise.all([
        prisma.pilotProgram.findMany({
          where,
          include: {
            participants: true,
            feedback: true,
            analytics: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          take: filters?.limit || 50,
          skip: filters?.offset || 0,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        prisma.pilotProgram.count({ where }),
      ]);

      return {
        programs: programs.map((p) => this.formatPilotProgram(p)),
        total,
      };
    } catch (error) {
      logger.error('Error listing pilot programs:', error);
      throw new Error('Failed to list pilot programs');
    }
  }

  /**
   * Get pilot analytics
   */
  async getPilotAnalytics(programId: string): Promise<PilotAnalytics | null> {
    try {
      const analytics = await prisma.pilotAnalytics.findFirst({
        where: { pilotProgramId: programId },
        orderBy: { createdAt: 'desc' },
      });

      if (!analytics) return null;
      return this.formatAnalytics(analytics);
    } catch (error) {
      logger.error('Error getting pilot analytics:', error);
      throw new Error('Failed to get pilot analytics');
    }
  }

  /**
   * Complete pilot program
   */
  async completePilotProgram(
    programId: string,
    completionReport: string
  ): Promise<PilotProgram> {
    try {
      // Generate final analytics
      await this.generateFinalAnalytics(programId);

      const program = await prisma.pilotProgram.update({
        where: { id: programId },
        data: {
          status: 'COMPLETED',
          completionReport,
          endDate: new Date(),
        },
      });

      logger.info(`Pilot program completed: ${programId}`);
      return this.formatPilotProgram(program);
    } catch (error) {
      logger.error('Error completing pilot program:', error);
      throw new Error('Failed to complete pilot program');
    }
  }

  /**
   * Initialize analytics for a new pilot program
   */
  private async initializePilotAnalytics(programId: string): Promise<void> {
    const program = await prisma.pilotProgram.findUnique({
      where: { id: programId },
    });

    if (!program) throw new Error('Pilot program not found');

    await prisma.pilotAnalytics.create({
      data: {
        pilotProgramId: programId,
        periodStart: program.startDate || new Date(),
        periodEnd: program.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  }

  /**
   * Update analytics based on feedback
   */
  private async updateAnalyticsFromFeedback(programId: string): Promise<void> {
    const feedback = await prisma.pilotFeedback.findMany({
      where: { pilotProgramId: programId },
    });

    if (feedback.length === 0) return;

    const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;

    await prisma.pilotAnalytics.updateMany({
      where: { pilotProgramId: programId },
      data: {
        averageSatisfactionScore: avgRating,
      },
    });
  }

  /**
   * Generate final analytics report
   */
  private async generateFinalAnalytics(programId: string): Promise<void> {
    const [participants, feedback] = await Promise.all([
      prisma.pilotParticipant.findMany({
        where: { pilotProgramId: programId },
      }),
      prisma.pilotFeedback.findMany({
        where: { pilotProgramId: programId },
      }),
    ]);

    const activeParticipants = participants.filter((p) => p.isActive).length;
    const avgRating = feedback.length > 0
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
      : 0;

    // Calculate total documents and signatures from participant stats
    let totalDocs = 0;
    let totalSigs = 0;
    participants.forEach((p) => {
      const stats = JSON.parse(p.usageStats as string);
      totalDocs += stats.documentsUploaded || 0;
      totalSigs += stats.documentsSigned || 0;
    });

    await prisma.pilotAnalytics.updateMany({
      where: { pilotProgramId: programId },
      data: {
        totalParticipants: participants.length,
        activeParticipants,
        documentsProcessed: totalDocs,
        signaturesCompleted: totalSigs,
        averageSatisfactionScore: avgRating,
      },
    });
  }

  /**
   * Format pilot program for response
   */
  private formatPilotProgram(program: any): PilotProgram {
    return {
      ...program,
      goals: JSON.parse(program.goals || '[]'),
      complianceNeeds: JSON.parse(program.complianceNeeds || '[]'),
    };
  }

  /**
   * Format participant for response
   */
  private formatParticipant(participant: any): PilotParticipant {
    return {
      ...participant,
      usageStats: JSON.parse(participant.usageStats || '{}'),
    };
  }

  /**
   * Format analytics for response
   */
  private formatAnalytics(analytics: any): PilotAnalytics {
    return {
      ...analytics,
      period: {
        startDate: analytics.periodStart,
        endDate: analytics.periodEnd,
      },
    };
  }
}

export const pilotProgramService = new PilotProgramService();

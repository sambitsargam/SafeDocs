import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export interface CreateTeamInput {
  name: string;
  description?: string;
  ownerId: string;
  subscriptionTier?: 'FREE' | 'PROFESSIONAL' | 'TEAM' | 'ENTERPRISE';
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
  settings?: any;
  isActive?: boolean;
}

export interface AddTeamMemberInput {
  teamId: string;
  userId: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  permissions?: string[];
  invitedBy: string;
}

export interface UpdateSubscriptionInput {
  tier: 'FREE' | 'PROFESSIONAL' | 'TEAM' | 'ENTERPRISE';
  billingCycle?: 'monthly' | 'yearly';
}

export class TeamService {
  /**
   * Create a new team with optional subscription
   */
  async createTeam(input: CreateTeamInput): Promise<any> {
    try {
      logger.info(`Creating team: ${input.name} for owner ${input.ownerId}`);

      // Create subscription first if tier specified
      let subscription = null;
      if (input.subscriptionTier && input.subscriptionTier !== 'FREE') {
        subscription = await this.createSubscription(input.subscriptionTier);
      }

      // Create team
      const team = await prisma.team.create({
        data: {
          name: input.name,
          description: input.description,
          ownerId: input.ownerId,
          subscriptionId: subscription?.id,
          settings: {},
        },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
              walletAddress: true,
            },
          },
          subscription: true,
        },
      });

      // Add owner as a team member with OWNER role
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: input.ownerId,
          role: 'OWNER',
          permissions: ['*'], // All permissions
          invitedBy: input.ownerId,
        },
      });

      logger.info(`Team created successfully: ${team.id}`);
      return team;
    } catch (error) {
      logger.error('Failed to create team:', error);
      throw new Error('Team creation failed');
    }
  }

  /**
   * Get team by ID with all details
   */
  async getTeamById(teamId: string, userId: string): Promise<any> {
    try {
      // Check if user is a member
      const membership = await this.getTeamMembership(teamId, userId);
      if (!membership) {
        throw new Error('User is not a member of this team');
      }

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
              walletAddress: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  walletAddress: true,
                  avatar: true,
                },
              },
            },
            orderBy: {
              joinedAt: 'desc',
            },
          },
          subscription: {
            include: {
              invoices: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 5,
              },
            },
          },
          documents: {
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  mimeType: true,
                  fileSize: true,
                  status: true,
                  createdAt: true,
                },
              },
            },
            orderBy: {
              sharedAt: 'desc',
            },
            take: 10,
          },
        },
      });

      if (!team) {
        throw new Error('Team not found');
      }

      // Get team statistics
      const stats = await this.getTeamStatistics(teamId);

      return {
        ...team,
        statistics: stats,
      };
    } catch (error) {
      logger.error('Failed to get team:', error);
      throw error;
    }
  }

  /**
   * Get all teams for a user
   */
  async getUserTeams(userId: string): Promise<any[]> {
    try {
      const memberships = await prisma.teamMember.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          team: {
            include: {
              owner: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
              subscription: true,
              _count: {
                select: {
                  members: true,
                  documents: true,
                },
              },
            },
          },
        },
        orderBy: {
          joinedAt: 'desc',
        },
      });

      return memberships.map(m => ({
        ...m.team,
        memberRole: m.role,
        memberPermissions: m.permissions,
      }));
    } catch (error) {
      logger.error('Failed to get user teams:', error);
      throw new Error('Failed to get user teams');
    }
  }

  /**
   * Update team details
   */
  async updateTeam(teamId: string, userId: string, input: UpdateTeamInput): Promise<any> {
    try {
      // Check if user has admin permissions
      const membership = await this.getTeamMembership(teamId, userId);
      if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
        throw new Error('Insufficient permissions');
      }

      const team = await prisma.team.update({
        where: { id: teamId },
        data: input,
        include: {
          owner: true,
          subscription: true,
        },
      });

      logger.info(`Team updated: ${teamId}`);
      return team;
    } catch (error) {
      logger.error('Failed to update team:', error);
      throw error;
    }
  }

  /**
   * Add member to team
   */
  async addTeamMember(input: AddTeamMemberInput): Promise<any> {
    try {
      // Check if inviter has permission
      const inviterMembership = await this.getTeamMembership(input.teamId, input.invitedBy);
      if (!inviterMembership || (inviterMembership.role !== 'OWNER' && inviterMembership.role !== 'ADMIN')) {
        throw new Error('Insufficient permissions to add members');
      }

      // Check team subscription limits
      const team = await prisma.team.findUnique({
        where: { id: input.teamId },
        include: {
          subscription: true,
          _count: {
            select: { members: true },
          },
        },
      });

      if (team?.subscription && team._count.members >= team.subscription.maxMembers) {
        throw new Error('Team member limit reached. Please upgrade subscription.');
      }

      // Check if user is already a member
      const existingMembership = await this.getTeamMembership(input.teamId, input.userId);
      if (existingMembership) {
        throw new Error('User is already a team member');
      }

      // Add member
      const member = await prisma.teamMember.create({
        data: {
          teamId: input.teamId,
          userId: input.userId,
          role: input.role || 'MEMBER',
          permissions: input.permissions || [],
          invitedBy: input.invitedBy,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              walletAddress: true,
              avatar: true,
            },
          },
        },
      });

      logger.info(`Team member added: ${input.userId} to team ${input.teamId}`);
      return member;
    } catch (error) {
      logger.error('Failed to add team member:', error);
      throw error;
    }
  }

  /**
   * Remove member from team
   */
  async removeTeamMember(teamId: string, memberId: string, removedBy: string): Promise<void> {
    try {
      // Check if remover has permission
      const removerMembership = await this.getTeamMembership(teamId, removedBy);
      if (!removerMembership || (removerMembership.role !== 'OWNER' && removerMembership.role !== 'ADMIN')) {
        throw new Error('Insufficient permissions to remove members');
      }

      // Get member to be removed
      const memberToRemove = await prisma.teamMember.findFirst({
        where: {
          teamId,
          userId: memberId,
        },
      });

      if (!memberToRemove) {
        throw new Error('Member not found');
      }

      // Cannot remove owner
      if (memberToRemove.role === 'OWNER') {
        throw new Error('Cannot remove team owner');
      }

      // Remove member
      await prisma.teamMember.delete({
        where: { id: memberToRemove.id },
      });

      logger.info(`Team member removed: ${memberId} from team ${teamId}`);
    } catch (error) {
      logger.error('Failed to remove team member:', error);
      throw error;
    }
  }

  /**
   * Update team member role and permissions
   */
  async updateTeamMemberRole(
    teamId: string,
    memberId: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER',
    updatedBy: string
  ): Promise<any> {
    try {
      // Check if updater has permission
      const updaterMembership = await this.getTeamMembership(teamId, updatedBy);
      if (!updaterMembership || updaterMembership.role !== 'OWNER') {
        throw new Error('Only team owner can update member roles');
      }

      const membership = await prisma.teamMember.findFirst({
        where: { teamId, userId: memberId },
      });

      if (!membership) {
        throw new Error('Member not found');
      }

      if (membership.role === 'OWNER') {
        throw new Error('Cannot change owner role');
      }

      const updated = await prisma.teamMember.update({
        where: { id: membership.id },
        data: { role },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      logger.info(`Team member role updated: ${memberId} to ${role}`);
      return updated;
    } catch (error) {
      logger.error('Failed to update member role:', error);
      throw error;
    }
  }

  /**
   * Share document with team
   */
  async shareDocumentWithTeam(
    teamId: string,
    documentId: string,
    sharedBy: string,
    permissions: string[] = ['view']
  ): Promise<any> {
    try {
      // Check if user is team member
      const membership = await this.getTeamMembership(teamId, sharedBy);
      if (!membership) {
        throw new Error('User is not a team member');
      }

      // Check if document exists and user has access
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          uploadedBy: sharedBy,
        },
      });

      if (!document) {
        throw new Error('Document not found or access denied');
      }

      // Check if already shared
      const existingShare = await prisma.teamDocument.findUnique({
        where: {
          teamId_documentId: {
            teamId,
            documentId,
          },
        },
      });

      if (existingShare) {
        throw new Error('Document already shared with team');
      }

      // Share document
      const teamDoc = await prisma.teamDocument.create({
        data: {
          teamId,
          documentId,
          sharedBy,
          permissions,
        },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              mimeType: true,
              fileSize: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      logger.info(`Document shared with team: ${documentId} to team ${teamId}`);
      return teamDoc;
    } catch (error) {
      logger.error('Failed to share document with team:', error);
      throw error;
    }
  }

  /**
   * Create subscription for team
   */
  private async createSubscription(tier: 'FREE' | 'PROFESSIONAL' | 'TEAM' | 'ENTERPRISE'): Promise<any> {
    const tierConfig = {
      FREE: { maxMembers: 1, maxDocuments: 10, maxStorage: 1073741824, price: 0 }, // 1GB
      PROFESSIONAL: { maxMembers: 5, maxDocuments: 100, maxStorage: 10737418240, price: 29 }, // 10GB
      TEAM: { maxMembers: 20, maxDocuments: 500, maxStorage: 107374182400, price: 99 }, // 100GB
      ENTERPRISE: { maxMembers: 999, maxDocuments: 10000, maxStorage: 1099511627776, price: 499 }, // 1TB
    };

    const config = tierConfig[tier];

    return await prisma.subscription.create({
      data: {
        tier,
        status: 'TRIAL',
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        billingCycle: 'monthly',
        price: config.price,
        maxMembers: config.maxMembers,
        maxDocuments: config.maxDocuments,
        maxStorage: config.maxStorage,
        features: this.getFeaturesForTier(tier),
      },
    });
  }

  /**
   * Update team subscription
   */
  async updateSubscription(
    teamId: string,
    userId: string,
    input: UpdateSubscriptionInput
  ): Promise<any> {
    try {
      // Check if user is team owner
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { subscription: true },
      });

      if (!team || team.ownerId !== userId) {
        throw new Error('Only team owner can update subscription');
      }

      let subscription;
      if (!team.subscriptionId) {
        // Create new subscription
        subscription = await this.createSubscription(input.tier);
        await prisma.team.update({
          where: { id: teamId },
          data: { subscriptionId: subscription.id },
        });
      } else {
        // Update existing subscription
        const tierConfig = {
          FREE: { maxMembers: 1, maxDocuments: 10, maxStorage: 1073741824, price: 0 },
          PROFESSIONAL: { maxMembers: 5, maxDocuments: 100, maxStorage: 10737418240, price: 29 },
          TEAM: { maxMembers: 20, maxDocuments: 500, maxStorage: 107374182400, price: 99 },
          ENTERPRISE: { maxMembers: 999, maxDocuments: 10000, maxStorage: 1099511627776, price: 499 },
        };

        const config = tierConfig[input.tier];

        subscription = await prisma.subscription.update({
          where: { id: team.subscriptionId },
          data: {
            tier: input.tier,
            billingCycle: input.billingCycle || 'monthly',
            price: config.price,
            maxMembers: config.maxMembers,
            maxDocuments: config.maxDocuments,
            maxStorage: config.maxStorage,
            features: this.getFeaturesForTier(input.tier),
          },
        });
      }

      logger.info(`Subscription updated for team ${teamId}`);
      return subscription;
    } catch (error) {
      logger.error('Failed to update subscription:', error);
      throw error;
    }
  }

  /**
   * Get team membership for user
   */
  private async getTeamMembership(teamId: string, userId: string): Promise<any> {
    return await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        isActive: true,
      },
    });
  }

  /**
   * Get team statistics
   */
  private async getTeamStatistics(teamId: string): Promise<any> {
    const [memberCount, documentCount, totalStorage] = await Promise.all([
      prisma.teamMember.count({ where: { teamId, isActive: true } }),
      prisma.teamDocument.count({ where: { teamId } }),
      prisma.teamDocument.findMany({
        where: { teamId },
        include: { document: { select: { fileSize: true } } },
      }).then(docs => docs.reduce((sum, doc) => sum + doc.document.fileSize, 0)),
    ]);

    return {
      memberCount,
      documentCount,
      totalStorage,
      storageUsedPercent: 0, // Calculate based on subscription limit
    };
  }

  /**
   * Get features for tier
   */
  private getFeaturesForTier(tier: string): string[] {
    const features: Record<string, string[]> = {
      FREE: ['Basic document management', 'Email support'],
      PROFESSIONAL: [
        'Advanced document management',
        'Priority support',
        'Custom branding',
        'API access',
      ],
      TEAM: [
        'Team collaboration',
        'Advanced analytics',
        'Custom workflows',
        'Dedicated support',
        'SSO integration',
      ],
      ENTERPRISE: [
        'Unlimited documents',
        'Advanced security',
        'Custom SLA',
        '24/7 support',
        'On-premise deployment',
        'Advanced compliance',
      ],
    };

    return features[tier] || features.FREE;
  }
}

export const teamService = new TeamService();

import express from 'express';
import { teamService } from '../services/teamService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/teams
 * Create a new team
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { name, description, subscriptionTier } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Team name is required',
      });
    }

    const team = await teamService.createTeam({
      name,
      description,
      ownerId: req.user.id,
      subscriptionTier,
    });

    res.status(201).json({
      success: true,
      data: team,
    });
  } catch (error) {
    logger.error('Team creation failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Team creation failed',
    });
  }
});

/**
 * GET /api/teams
 * Get all teams for current user
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const teams = await teamService.getUserTeams(req.user.id);

    res.json({
      success: true,
      data: teams,
    });
  } catch (error) {
    logger.error('Failed to get teams:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get teams',
    });
  }
});

/**
 * GET /api/teams/:id
 * Get team details by ID
 */
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const team = await teamService.getTeamById(id, req.user.id);

    res.json({
      success: true,
      data: team,
    });
  } catch (error) {
    logger.error('Failed to get team:', error);
    res.status(error instanceof Error && error.message.includes('not a member') ? 403 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get team',
    });
  }
});

/**
 * PATCH /api/teams/:id
 * Update team details
 */
router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { name, description, settings, isActive } = req.body;

    const team = await teamService.updateTeam(id, req.user.id, {
      name,
      description,
      settings,
      isActive,
    });

    res.json({
      success: true,
      data: team,
    });
  } catch (error) {
    logger.error('Failed to update team:', error);
    res.status(error instanceof Error && error.message.includes('permissions') ? 403 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update team',
    });
  }
});

/**
 * POST /api/teams/:id/members
 * Add member to team
 */
router.post('/:id/members', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { userId, role, permissions } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const member = await teamService.addTeamMember({
      teamId: id,
      userId,
      role,
      permissions,
      invitedBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: member,
    });
  } catch (error) {
    logger.error('Failed to add team member:', error);
    res.status(error instanceof Error && error.message.includes('permissions') ? 403 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add team member',
    });
  }
});

/**
 * DELETE /api/teams/:id/members/:memberId
 * Remove member from team
 */
router.delete('/:id/members/:memberId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id, memberId } = req.params;
    await teamService.removeTeamMember(id, memberId, req.user.id);

    res.json({
      success: true,
      message: 'Team member removed successfully',
    });
  } catch (error) {
    logger.error('Failed to remove team member:', error);
    res.status(error instanceof Error && error.message.includes('permissions') ? 403 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove team member',
    });
  }
});

/**
 * PATCH /api/teams/:id/members/:memberId/role
 * Update team member role
 */
router.patch('/:id/members/:memberId/role', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id, memberId } = req.params;
    const { role } = req.body;

    if (!role || !['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required (ADMIN, MEMBER, or VIEWER)',
      });
    }

    const member = await teamService.updateTeamMemberRole(id, memberId, role, req.user.id);

    res.json({
      success: true,
      data: member,
    });
  } catch (error) {
    logger.error('Failed to update member role:', error);
    res.status(error instanceof Error && error.message.includes('permissions') ? 403 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update member role',
    });
  }
});

/**
 * POST /api/teams/:id/documents
 * Share document with team
 */
router.post('/:id/documents', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { documentId, permissions } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: 'Document ID is required',
      });
    }

    const teamDoc = await teamService.shareDocumentWithTeam(
      id,
      documentId,
      req.user.id,
      permissions
    );

    res.status(201).json({
      success: true,
      data: teamDoc,
    });
  } catch (error) {
    logger.error('Failed to share document with team:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to share document',
    });
  }
});

/**
 * POST /api/teams/:id/subscription
 * Update team subscription
 */
router.post('/:id/subscription', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { tier, billingCycle } = req.body;

    if (!tier || !['FREE', 'PROFESSIONAL', 'TEAM', 'ENTERPRISE'].includes(tier)) {
      return res.status(400).json({
        success: false,
        message: 'Valid subscription tier is required',
      });
    }

    const subscription = await teamService.updateSubscription(id, req.user.id, {
      tier,
      billingCycle,
    });

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    logger.error('Failed to update subscription:', error);
    res.status(error instanceof Error && error.message.includes('owner') ? 403 : 500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update subscription',
    });
  }
});

/**
 * GET /api/teams/:id/subscription
 * Get team subscription details
 */
router.get('/:id/subscription', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { prisma } = await import('../utils/database');

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            invoices: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    // Check if user is team member
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: id,
        userId: req.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: team.subscription,
    });
  } catch (error) {
    logger.error('Failed to get subscription:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get subscription',
    });
  }
});

export default router;

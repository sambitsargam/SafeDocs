import { Router, Request, Response } from 'express';
import { pilotProgramService } from '../services/pilotProgramService';
import { industryTemplateService } from '../services/industryTemplateService';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Create a new pilot program application
 * POST /api/pilots
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      organizationName,
      industryType,
      contactPerson,
      contactEmail,
      contactPhone,
      companySize,
      currentSolution,
      estimatedDocumentVolume,
      goals,
      specialRequirements,
      complianceNeeds,
    } = req.body;

    // Validation
    if (!organizationName || !industryType || !contactPerson || !contactEmail || !companySize) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }

    const program = await pilotProgramService.createPilotProgram({
      organizationName,
      industryType,
      contactPerson,
      contactEmail,
      contactPhone,
      companySize,
      currentSolution,
      estimatedDocumentVolume: estimatedDocumentVolume || 100,
      goals: goals || [],
      specialRequirements,
      complianceNeeds: complianceNeeds || [],
    });

    res.status(201).json({
      success: true,
      data: program,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error creating pilot program:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to create pilot program',
      },
    });
  }
});

/**
 * Get all pilot programs (admin only)
 * GET /api/pilots
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, industryType, limit, offset } = req.query;

    const result = await pilotProgramService.listPilotPrograms({
      status: status as any,
      industryType: industryType as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error listing pilot programs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to list pilot programs',
      },
    });
  }
});

/**
 * Get pilot program by ID
 * GET /api/pilots/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const program = await pilotProgramService.getPilotProgram(id);

    if (!program) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Pilot program not found',
        },
      });
    }

    res.json({
      success: true,
      data: program,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error getting pilot program:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to get pilot program',
      },
    });
  }
});

/**
 * Approve a pilot program (admin only)
 * POST /api/pilots/:id/approve
 */
router.post('/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    }

    const program = await pilotProgramService.approvePilotProgram(
      id,
      userId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      data: program,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error approving pilot program:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to approve pilot program',
      },
    });
  }
});

/**
 * Start a pilot program
 * POST /api/pilots/:id/start
 */
router.post('/:id/start', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const program = await pilotProgramService.startPilotProgram(id);

    res.json({
      success: true,
      data: program,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error starting pilot program:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to start pilot program',
      },
    });
  }
});

/**
 * Complete a pilot program
 * POST /api/pilots/:id/complete
 */
router.post('/:id/complete', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { completionReport } = req.body;

    const program = await pilotProgramService.completePilotProgram(id, completionReport);

    res.json({
      success: true,
      data: program,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error completing pilot program:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to complete pilot program',
      },
    });
  }
});

/**
 * Add participant to pilot program
 * POST /api/pilots/:id/participants
 */
router.post('/:id/participants', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, role, department } = req.body;

    if (!userId || !role) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: userId, role',
        },
      });
    }

    const participant = await pilotProgramService.addParticipant({
      pilotProgramId: id,
      userId,
      role,
      department,
    });

    res.status(201).json({
      success: true,
      data: participant,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error adding participant:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to add participant',
      },
    });
  }
});

/**
 * Submit feedback for pilot program
 * POST /api/pilots/:id/feedback
 */
router.post('/:id/feedback', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      participantId,
      category,
      rating,
      feedback,
      suggestedImprovements,
      wouldRecommend,
      isPublic,
    } = req.body;

    if (!participantId || !category || !rating || !feedback) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }

    const feedbackRecord = await pilotProgramService.submitFeedback({
      pilotProgramId: id,
      participantId,
      category,
      rating,
      feedback,
      suggestedImprovements,
      wouldRecommend: wouldRecommend !== false,
      isPublic: isPublic || false,
    });

    res.status(201).json({
      success: true,
      data: feedbackRecord,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to submit feedback',
      },
    });
  }
});

/**
 * Get pilot analytics
 * GET /api/pilots/:id/analytics
 */
router.get('/:id/analytics', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const analytics = await pilotProgramService.getPilotAnalytics(id);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Analytics not found',
        },
      });
    }

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error getting pilot analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to get pilot analytics',
      },
    });
  }
});

/**
 * Get industry templates
 * GET /api/pilots/templates/:industryType
 */
router.get('/templates/:industryType', async (req: Request, res: Response) => {
  try {
    const { industryType } = req.params;
    const templates = await industryTemplateService.getTemplatesByIndustry(industryType as any);

    res.json({
      success: true,
      data: templates,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to get templates',
      },
    });
  }
});

/**
 * Get popular templates
 * GET /api/pilots/templates/popular
 */
router.get('/templates/popular/all', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const templates = await industryTemplateService.getPopularTemplates(
      limit ? parseInt(limit as string) : 10
    );

    res.json({
      success: true,
      data: templates,
      timestamp: new Date(),
      requestId: req.id,
    });
  } catch (error: any) {
    logger.error('Error getting popular templates:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to get popular templates',
      },
    });
  }
});

export default router;

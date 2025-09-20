import express from 'express';
import { auditComplianceService } from '../services/auditComplianceService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/compliance/report
 * Generate compliance report
 */
router.post('/report', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check admin permissions
    if (req.user.role !== 'ADMIN' && req.user.role !== 'ENTERPRISE') {
      return res.status(403).json({
        success: false,
        message: 'Admin permissions required for compliance reports',
      });
    }

    const {
      framework = 'ALL',
      startDate,
      endDate,
    } = req.body;

    // Validate framework
    const validFrameworks = ['HIPAA', 'SOX', 'GDPR', 'SOC2', 'ALL'];
    if (!validFrameworks.includes(framework)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid compliance framework',
      });
    }

    // Validate dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date',
      });
    }

    logger.info(`Generating compliance report: ${framework} for user ${req.user.id}`);

    const report = await auditComplianceService.generateComplianceReport(
      framework,
      start,
      end,
      req.user.id
    );

    res.json({
      success: true,
      data: report,
    });

  } catch (error) {
    logger.error('Compliance report generation failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Compliance report generation failed',
    });
  }
});

/**
 * GET /api/compliance/dashboard
 * Get compliance dashboard data
 */
router.get('/dashboard', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      framework,
      timeRange = 'month',
    } = req.query;

    const validTimeRanges = ['day', 'week', 'month', 'quarter'];
    if (!validTimeRanges.includes(timeRange as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time range',
      });
    }

    const dashboard = await auditComplianceService.getComplianceDashboard(
      framework as string,
      timeRange as 'day' | 'week' | 'month' | 'quarter'
    );

    res.json({
      success: true,
      data: dashboard,
    });

  } catch (error) {
    logger.error('Compliance dashboard failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Compliance dashboard failed',
    });
  }
});

/**
 * GET /api/compliance/violations
 * Get current compliance violations
 */
router.get('/violations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const violations = await auditComplianceService.monitorComplianceViolations();

    res.json({
      success: true,
      data: {
        violations,
        summary: {
          total: violations.length,
          critical: violations.filter(v => v.severity === 'CRITICAL').length,
          high: violations.filter(v => v.severity === 'HIGH').length,
          medium: violations.filter(v => v.severity === 'MEDIUM').length,
          low: violations.filter(v => v.severity === 'LOW').length,
        },
      },
    });

  } catch (error) {
    logger.error('Compliance violations check failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Compliance violations check failed',
    });
  }
});

/**
 * POST /api/compliance/audit-log
 * Create audit log entry
 */
router.post('/audit-log', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      action,
      details,
      documentId,
      complianceLevel,
      metadata,
    } = req.body;

    if (!action || !details) {
      return res.status(400).json({
        success: false,
        message: 'Action and details are required',
      });
    }

    await auditComplianceService.logAuditEvent({
      userId: req.user.id,
      documentId,
      action,
      details,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      complianceLevel,
      metadata,
    });

    res.json({
      success: true,
      message: 'Audit event logged successfully',
    });

  } catch (error) {
    logger.error('Audit logging failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Audit logging failed',
    });
  }
});

/**
 * POST /api/compliance/validate-access
 * Validate access for specific action
 */
router.post('/validate-access', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      resource,
      action,
      context = {},
    } = req.body;

    if (!resource || !action) {
      return res.status(400).json({
        success: false,
        message: 'Resource and action are required',
      });
    }

    const accessResult = await auditComplianceService.validateAccess(
      req.user.id,
      resource,
      action,
      {
        ...context,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({
      success: true,
      data: accessResult,
    });

  } catch (error) {
    logger.error('Access validation failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Access validation failed',
    });
  }
});

/**
 * GET /api/compliance/reports
 * Get list of generated compliance reports
 */
router.get('/reports', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      framework,
      limit = 20,
      offset = 0,
    } = req.query;

    const { prisma } = await import('../utils/database');

    const whereClause: any = {};
    if (framework && framework !== 'ALL') {
      whereClause.framework = framework;
    }

    // Non-admin users can only see their own reports
    if (req.user.role !== 'ADMIN') {
      whereClause.generatedBy = req.user.id;
    }

    const [reports, total] = await Promise.all([
      prisma.complianceReport.findMany({
        where: whereClause,
        include: {
          generator: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.complianceReport.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      data: {
        reports: reports.map((report: any) => ({
          id: report.id,
          framework: report.framework,
          generatedBy: report.generator,
          timeRange: {
            start: report.timeRangeStart,
            end: report.timeRangeEnd,
          },
          certificationStatus: report.certificationStatus,
          summary: JSON.parse(report.summary as string),
          createdAt: report.createdAt,
        })),
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: total > parseInt(offset as string) + parseInt(limit as string),
        },
      },
    });

  } catch (error) {
    logger.error('Failed to get compliance reports:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get compliance reports',
    });
  }
});

/**
 * GET /api/compliance/reports/:id
 * Get specific compliance report details
 */
router.get('/reports/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { prisma } = await import('../utils/database');

    const report = await prisma.complianceReport.findUnique({
      where: { id },
      include: {
        generator: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Compliance report not found',
      });
    }

    // Check access permissions
    if (req.user.role !== 'ADMIN' && report.generatedBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: JSON.parse(report.reportData as string),
    });

  } catch (error) {
    logger.error('Failed to get compliance report:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get compliance report',
    });
  }
});

/**
 * GET /api/compliance/audit-logs
 * Get audit logs with filtering
 */
router.get('/audit-logs', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      action,
      documentId,
      userId,
      startDate,
      endDate,
      complianceLevel,
      limit = 50,
      offset = 0,
    } = req.query;

    const { prisma } = await import('../utils/database');

    // Build where clause
    const whereClause: any = {};
    
    if (action) whereClause.action = action;
    if (documentId) whereClause.documentId = documentId;
    if (complianceLevel) whereClause.complianceLevel = complianceLevel;
    
    // Non-admin users can only see their own audit logs
    if (req.user.role !== 'ADMIN') {
      whereClause.userId = req.user.id;
    } else if (userId) {
      whereClause.userId = userId;
    }

    if (startDate && endDate) {
      whereClause.timestamp = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          document: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.auditLog.count({ where: whereClause }),
    ]);

    res.json({
      success: true,
      data: {
        auditLogs,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: total > parseInt(offset as string) + parseInt(limit as string),
        },
      },
    });

  } catch (error) {
    logger.error('Failed to get audit logs:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get audit logs',
    });
  }
});

export default router;
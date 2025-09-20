import express from 'express';
import { verificationService } from '../services/verificationService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/verification/verify/:id
 * Verify a single document
 */
router.post('/verify/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { verificationLevel = 'STANDARD' } = req.body;

    // Validate verification level
    const validLevels = ['BASIC', 'STANDARD', 'ENHANCED', 'MAXIMUM'];
    if (!validLevels.includes(verificationLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification level',
      });
    }

    logger.info(`Starting document verification: ${id} (level: ${verificationLevel})`);

    const result = await verificationService.verifyDocument(id, verificationLevel);

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Document verification API failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Verification failed',
    });
  }
});

/**
 * POST /api/verification/batch
 * Batch verify multiple documents
 */
router.post('/batch', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { documentIds, verificationLevel = 'STANDARD' } = req.body;

    // Validate input
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'documentIds must be a non-empty array',
      });
    }

    if (documentIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 50 documents can be verified in a batch',
      });
    }

    const validLevels = ['BASIC', 'STANDARD', 'ENHANCED', 'MAXIMUM'];
    if (!validLevels.includes(verificationLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification level',
      });
    }

    logger.info(`Starting batch verification: ${documentIds.length} documents (level: ${verificationLevel})`);

    const result = await verificationService.batchVerifyDocuments(documentIds, verificationLevel);

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Batch verification API failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Batch verification failed',
    });
  }
});

/**
 * GET /api/verification/history/:id
 * Get verification history for a document
 */
router.get('/history/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    // Get verification history from database
    const { prisma } = await import('../utils/database');
    
    const verificationHistory = await prisma.verificationResult.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.verificationResult.count({
      where: { documentId: id },
    });

    res.json({
      success: true,
      data: {
        verifications: verificationHistory,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: total > parseInt(offset as string) + parseInt(limit as string),
        },
      },
    });

  } catch (error) {
    logger.error('Verification history API failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retrieve verification history',
    });
  }
});

/**
 * GET /api/verification/analytics
 * Get verification analytics and insights
 */
router.get('/analytics', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { timeRange = '30d' } = req.query;

    // Calculate date range
    let startDate: Date;
    const endDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const { prisma } = await import('../utils/database');

    // Get verification statistics
    const [
      totalVerifications,
      successfulVerifications,
      averageConfidence,
      verificationsByLevel,
      verificationTrends,
    ] = await Promise.all([
      // Total verifications
      prisma.verificationResult.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // Successful verifications
      prisma.verificationResult.count({
        where: {
          isValid: true,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // Average confidence
      prisma.verificationResult.aggregate({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _avg: {
          confidence: true,
        },
      }),

      // Verifications by level
      prisma.verificationResult.groupBy({
        by: ['verificationLevel'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          verificationLevel: true,
        },
      }),

      // Daily verification trends
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_verifications,
          COUNT(CASE WHEN is_valid = true THEN 1 END) as successful_verifications,
          AVG(confidence) as avg_confidence
        FROM verification_result
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,
    ]);

    // Calculate success rate
    const successRate = totalVerifications > 0 
      ? Math.round((successfulVerifications / totalVerifications) * 100)
      : 0;

    // Format verification level statistics
    const levelStats = verificationsByLevel.map((level: any) => ({
      level: level.verificationLevel,
      count: level._count.verificationLevel,
      percentage: totalVerifications > 0 
        ? Math.round((level._count.verificationLevel / totalVerifications) * 100)
        : 0,
    }));

    const analytics = {
      summary: {
        totalVerifications,
        successfulVerifications,
        successRate,
        averageConfidence: Math.round(averageConfidence._avg.confidence || 0),
        timeRange,
      },
      levelDistribution: levelStats,
      trends: verificationTrends,
      insights: {
        mostUsedLevel: levelStats.reduce((prev: any, current: any) => 
          prev.count > current.count ? prev : current
        )?.level || 'N/A',
        recommendedActions: generateVerificationInsights(successRate, averageConfidence._avg.confidence || 0),
      },
    };

    res.json({
      success: true,
      data: analytics,
    });

  } catch (error) {
    logger.error('Verification analytics API failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retrieve verification analytics',
    });
  }
});

/**
 * GET /api/verification/compliance-report
 * Generate compliance verification report
 */
router.get('/compliance-report', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user has admin access for compliance reports
    if (req.user.role !== 'ADMIN' && req.user.role !== 'ENTERPRISE') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for compliance reports',
      });
    }

    const { complianceLevel, startDate, endDate } = req.query;

    const { prisma } = await import('../utils/database');

    // Build query filters
    const whereClause: any = {};
    
    if (complianceLevel) {
      whereClause.document = {
        complianceLevel: complianceLevel as string,
      };
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Get verification results with document compliance information
    const verifications = await prisma.verificationResult.findMany({
      where: whereClause,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            complianceLevel: true,
            uploadedBy: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generate compliance statistics
    const complianceStats = {
      totalDocuments: verifications.length,
      validDocuments: verifications.filter((v: any) => v.isValid).length,
      complianceLevels: {} as any,
      averageConfidenceByLevel: {} as any,
      failureReasons: [] as string[],
    };

    // Group by compliance level
    verifications.forEach((verification: any) => {
      const level = verification.document.complianceLevel;
      if (!complianceStats.complianceLevels[level]) {
        complianceStats.complianceLevels[level] = {
          total: 0,
          valid: 0,
          confidence: 0,
        };
      }
      
      complianceStats.complianceLevels[level].total++;
      if (verification.isValid) {
        complianceStats.complianceLevels[level].valid++;
      }
      complianceStats.complianceLevels[level].confidence += verification.confidence;
    });

    // Calculate averages
    Object.keys(complianceStats.complianceLevels).forEach(level => {
      const stats = complianceStats.complianceLevels[level];
      stats.confidence = Math.round(stats.confidence / stats.total);
      stats.successRate = Math.round((stats.valid / stats.total) * 100);
    });

    // Extract common failure reasons
    verifications
      .filter((v: any) => !v.isValid)
      .forEach((v: any) => {
        const anomalies = v.anomalies || [];
        complianceStats.failureReasons.push(...anomalies);
      });

    const report = {
      metadata: {
        generatedAt: new Date(),
        timeRange: {
          start: startDate || 'All time',
          end: endDate || 'All time',
        },
        complianceLevel: complianceLevel || 'All levels',
        generatedBy: req.user.id,
      },
      statistics: complianceStats,
      verifications: verifications.map((v: any) => ({
        id: v.id,
        documentId: v.documentId,
        documentTitle: v.document.title,
        isValid: v.isValid,
        confidence: v.confidence,
        verificationLevel: v.verificationLevel,
        complianceLevel: v.document.complianceLevel,
        createdAt: v.createdAt,
        anomalies: v.anomalies,
        warnings: v.warnings,
      })),
    };

    res.json({
      success: true,
      data: report,
    });

  } catch (error) {
    logger.error('Compliance report API failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate compliance report',
    });
  }
});

/**
 * Helper function to generate verification insights
 */
function generateVerificationInsights(successRate: number, averageConfidence: number): string[] {
  const insights: string[] = [];

  if (successRate < 80) {
    insights.push('Consider investigating documents with failed verifications');
  }

  if (averageConfidence < 70) {
    insights.push('Average confidence is low - consider upgrading verification levels');
  }

  if (successRate > 95 && averageConfidence > 85) {
    insights.push('Excellent verification performance - documents are well-secured');
  }

  if (insights.length === 0) {
    insights.push('Verification performance is within acceptable ranges');
  }

  return insights;
}

export default router;
import { Router } from 'express';
import multer from 'multer';
import { documentService } from '../services/documentService';
import { digitalSigningService } from '../services/digitalSigningService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, text, and image files are allowed.'));
    }
  },
});

/**
 * POST /api/documents/upload
 * Upload a document to Filecoin
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      title,
      description,
      complianceLevel = 'STANDARD',
      retentionPeriod,
      isEncrypted = true,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Document title is required',
      });
    }

    const uploadData = {
      file: {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      title,
      description,
      complianceLevel,
      retentionPeriod: retentionPeriod ? parseInt(retentionPeriod) : undefined,
      isEncrypted: isEncrypted === 'true' || isEncrypted === true,
      uploadedBy: req.user.walletAddress,
    };

    const result = await documentService.uploadDocument(uploadData);

    logger.info(`Document uploaded successfully: ${result.document.id}`);

    res.status(201).json({
      success: true,
      data: {
        document: result.document,
        storageProof: result.storageProof,
        costAnalysis: result.costAnalysis,
      },
      message: 'Document uploaded successfully to Filecoin',
    });

  } catch (error) {
    logger.error('Document upload failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Document upload failed',
    });
  }
});

/**
 * GET /api/documents/:id
 * Get document details by ID
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
    const { download } = req.query;

    if (download === 'true') {
      // Extract user location from request headers or query params
      const lat = parseFloat(req.headers['x-user-lat'] as string);
      const lng = parseFloat(req.headers['x-user-lng'] as string);
      const country = req.headers['x-user-country'] as string;

      // Build location object only if we have valid lat/lng
      let userLocation: { lat: number; lng: number; country?: string } | undefined;
      if (!isNaN(lat) && !isNaN(lng)) {
        userLocation = { lat, lng };
        if (country) {
          userLocation.country = country;
        }
      }

      // Retrieve document content with CDN optimization
      const result = await documentService.retrieveDocument(id, req.user.id, userLocation);
      
      res.setHeader('Content-Type', result.document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.document.originalFileName}"`);
      res.setHeader('X-Document-Verified', result.verified.toString());
      res.setHeader('X-Retrieval-Source', result.retrievalMetrics.source);
      res.setHeader('X-Retrieval-Time', result.retrievalMetrics.retrievalTime.toString());
      if (result.retrievalMetrics.nodeUsed) {
        res.setHeader('X-CDN-Node', result.retrievalMetrics.nodeUsed);
      }
      if (result.retrievalMetrics.cacheHit !== undefined) {
        res.setHeader('X-Cache-Hit', result.retrievalMetrics.cacheHit.toString());
      }
      
      return res.send(result.buffer);
    } else {
      // Get document metadata only
      const document = await documentService.verifyDocument(id);
      
      res.json({
        success: true,
        data: document,
      });
    }

  } catch (error) {
    logger.error('Document retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Document retrieval failed',
    });
  }
});

/**
 * POST /api/documents/:id/sign
 * Sign a document
 */
router.post('/:id/sign', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id: documentId } = req.params;
    const {
      signatureData,
      signerName,
      signerEmail,
      signatureAlgorithm = 'ECDSA',
    } = req.body;

    if (!signatureData || !signerName) {
      return res.status(400).json({
        success: false,
        message: 'Signature data and signer name are required',
      });
    }

    const signingRequest = {
      documentId,
      signerWalletAddress: req.user.walletAddress,
      signerName,
      signerEmail,
      signatureData,
      signatureAlgorithm,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };

    const result = await digitalSigningService.signDocument(signingRequest);

    logger.info(`Document signed successfully: ${documentId} by ${req.user.walletAddress}`);

    res.json({
      success: true,
      data: {
        signature: result.signature,
        verificationResult: result.verificationResult,
        blockchainTxHash: result.blockchainTxHash,
      },
      message: 'Document signed successfully',
    });

  } catch (error) {
    logger.error('Document signing failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Document signing failed',
    });
  }
});

/**
 * POST /api/documents/:id/sign/initiate
 * Initiate signing session
 */
router.post('/:id/sign/initiate', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id: documentId } = req.params;

    const session = await digitalSigningService.initiateSigningSession(
      documentId,
      req.user.walletAddress
    );

    res.json({
      success: true,
      data: session,
      message: 'Signing session initiated',
    });

  } catch (error) {
    logger.error('Signing session initiation failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initiate signing session',
    });
  }
});

/**
 * GET /api/documents/:id/verify
 * Verify document and signatures
 */
router.get('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;

    const verificationResult = await documentService.verifyDocument(id);

    res.json({
      success: true,
      data: verificationResult,
      message: verificationResult.isValid ? 'Document verified successfully' : 'Document verification failed',
    });

  } catch (error) {
    logger.error('Document verification failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Document verification failed',
    });
  }
});

/**
 * GET /api/documents/:id/signatures
 * Get all signatures for a document
 */
router.get('/:id/signatures', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { id: documentId } = req.params;

    const batchResult = await digitalSigningService.batchVerifySignatures(documentId);

    res.json({
      success: true,
      data: batchResult,
      message: `Verified ${batchResult.validSignatures}/${batchResult.totalSignatures} signatures`,
    });

  } catch (error) {
    logger.error('Signature verification failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Signature verification failed',
    });
  }
});

/**
 * GET /api/documents
 * List user's documents with pagination and filtering
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
      complianceLevel,
      search,
    } = req.query;

    // This would typically use a dedicated service method for listing documents
    const stats = await documentService.getDocumentStats(req.user.walletAddress);

    res.json({
      success: true,
      data: {
        documents: [], // Would be populated with actual document list
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: stats.totalDocuments,
          totalPages: Math.ceil(stats.totalDocuments / parseInt(limit as string)),
        },
        stats,
      },
    });

  } catch (error) {
    logger.error('Document listing failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retrieve documents',
    });
  }
});

/**
 * GET /api/documents/stats
 * Get document statistics
 */
router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const stats = await documentService.getDocumentStats(
      req.user.role === 'ADMIN' ? undefined : req.user.walletAddress
    );

    const signingStats = await digitalSigningService.getSigningStats('month');

    res.json({
      success: true,
      data: {
        documents: stats,
        signatures: signingStats,
      },
    });

  } catch (error) {
    logger.error('Stats retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retrieve statistics',
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document (admin only)
 */
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { id } = req.params;

    // This would implement document deletion
    // For compliance reasons, this might just mark as deleted rather than actually remove

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });

  } catch (error) {
    logger.error('Document deletion failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Document deletion failed',
    });
  }
});

export { router as documentRoutes };
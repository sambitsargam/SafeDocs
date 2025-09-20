import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { synapseAuthService } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
    email?: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      // Verify the JWT token
      const user = await synapseAuthService.verifyToken(token);
      
      // Attach user to request
      req.user = user;
      
      logger.debug('User authenticated via middleware:', {
        userId: user.id,
        walletAddress: user.walletAddress,
      });

      next();
    } catch (error) {
      logger.debug('Token verification failed:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const user = await synapseAuthService.verifyToken(token);
        req.user = user;
        
        logger.debug('User optionally authenticated:', {
          userId: user.id,
          walletAddress: user.walletAddress,
        });
      } catch (error) {
        logger.debug('Optional auth failed:', error);
        // Continue without user context
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Continue even if error occurs
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};
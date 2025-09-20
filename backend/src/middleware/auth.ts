import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // For now, this is a placeholder
  // We'll implement proper authentication when we integrate Synapse SDK
  logger.debug('Auth middleware called:', {
    url: req.url,
    method: req.method,
    hasAuth: !!req.headers.authorization,
  });

  next();
};
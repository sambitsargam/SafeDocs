import { Request, Response } from 'express';
import { synapseAuthService } from '../services/authService';
import { logger } from '../utils/logger';

export interface Context {
  req: Request;
  res: Response;
  user?: any;
  token?: string;
}

export const createContext = async ({ req, res }: { req: Request; res: Response }): Promise<Context> => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  
  const context: Context = {
    req,
    res,
    token,
  };

  // If token exists, try to authenticate user
  if (token) {
    try {
      const user = await synapseAuthService.verifyToken(token);
      context.user = user;
      
      logger.debug('User authenticated from token:', { 
        userId: user.id, 
        walletAddress: user.walletAddress 
      });
    } catch (error) {
      logger.debug('Token verification failed:', error);
      // Don't throw error, just continue without user context
    }
  }

  // Log the request for debugging
  logger.debug('GraphQL Context Created:', {
    method: req.method,
    url: req.url,
    hasToken: !!token,
    hasUser: !!context.user,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  return context;
};
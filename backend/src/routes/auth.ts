import { Router } from 'express';
import { synapseAuthService } from '../services/authService';
import { logger } from '../utils/logger';

const router = Router();

// Generate authentication message
router.post('/message', async (req, res) => {
  try {
    const { walletAddress, chainId } = req.body;

    if (!walletAddress || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address and chain ID are required',
      });
    }

    const messageData = synapseAuthService.generateAuthMessage(walletAddress, chainId);
    
    logger.info('Generated auth message:', { walletAddress, chainId });

    res.json({
      success: true,
      message: messageData.message,
      messageData,
    });
  } catch (error: any) {
    logger.error('Failed to generate auth message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate authentication message',
    });
  }
});

// Authenticate with wallet signature
router.post('/authenticate', async (req, res) => {
  try {
    const { walletAddress, signature, message, chainId } = req.body;

    if (!walletAddress || !signature || !message || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'All authentication parameters are required',
      });
    }

    const result = await synapseAuthService.authenticateWallet(
      walletAddress,
      signature,
      message,
      chainId
    );

    logger.info('Authentication successful:', { 
      userId: result.user.id, 
      walletAddress: result.user.walletAddress 
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Authentication failed:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed',
    });
  }
});

// Verify token (protected route)
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const user = await synapseAuthService.verifyToken(token);

    res.json({
      success: true,
      user,
      valid: true,
    });
  } catch (error: any) {
    logger.error('Token verification failed:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid token',
      valid: false,
    });
  }
});

// Logout (optional - JWT is stateless)
router.post('/logout', async (req, res) => {
  // Since JWT is stateless, we just return success
  // In a production system, you might want to maintain a blacklist
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;
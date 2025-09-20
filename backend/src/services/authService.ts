import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';

interface SIWEMessageParams {
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}

export interface WalletAuthMessage {
  message: string;
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}

export interface WalletAuthMessage {
  message: string;
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

export interface AuthenticationResult {
  user: any;
  token: string;
  wallet: {
    address: string;
    chainId: number;
    networkName: string;
    provider: string;
    isConnected: boolean;
  };
}

export class SynapseAuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET not set, using fallback secret. This is insecure for production!');
    }
  }

  /**
   * Generate a SIWE (Sign-In with Ethereum) message
   */
  generateAuthMessage(walletAddress: string, chainId: number): WalletAuthMessage {
    const domain = process.env.DOMAIN || 'localhost:4000';
    const uri = process.env.URI || 'http://localhost:4000';
    const nonce = this.generateNonce();
    const issuedAt = new Date().toISOString();
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const messageText = this.buildSIWEMessage({
      domain,
      address: walletAddress,
      uri,
      version: '1',
      chainId,
      nonce,
      issuedAt,
      expirationTime,
    } as SIWEMessageParams);

    return {
      message: messageText,
      domain,
      address: walletAddress,
      uri,
      version: '1',
      chainId,
      nonce,
      issuedAt,
      expirationTime,
    };
  }

  /**
   * Verify wallet signature and authenticate user
   */
  async authenticateWallet(
    walletAddress: string,
    signature: string,
    message: string,
    chainId: number
  ): Promise<AuthenticationResult> {
    try {
      // Verify the signature
      const isValidSignature = await this.verifySignature(walletAddress, signature, message);
      
      if (!isValidSignature) {
        throw new Error('Invalid signature');
      }

      // Check if message is expired
      const messageData = this.parseSIWEMessage(message);
      if (messageData.expirationTime && new Date() > new Date(messageData.expirationTime)) {
        throw new Error('Authentication message has expired');
      }

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            walletAddress: walletAddress.toLowerCase(),
            lastLoginAt: new Date(),
          },
        });
        
        logger.info('New user created:', { walletAddress: user.walletAddress });
      } else {
        // Update last login
        user = await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }

      // Generate JWT token
      const token = this.generateJWT(user);

      // Create wallet connection object
      const wallet = {
        address: walletAddress,
        chainId,
        networkName: this.getNetworkName(chainId),
        provider: 'synapse-sdk',
        isConnected: true,
      };

      // Log authentication event
      await this.logAuthEvent(user.id, 'USER_LOGIN', {
        walletAddress,
        chainId,
        networkName: wallet.networkName,
      });

      return {
        user,
        token,
        wallet,
      };

    } catch (error) {
      logger.error('Authentication failed:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Verify JWT token and return user
   */
  async verifyToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Token verification failed:', error);
      throw new Error('Invalid token');
    }
  }

  /**
   * Verify wallet signature
   */
  private async verifySignature(walletAddress: string, signature: string, message: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
    } catch (error) {
      logger.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Generate JWT token
   */
  private generateJWT(user: any): string {
    return jwt.sign(
      { 
        userId: user.id, 
        walletAddress: user.walletAddress,
        role: user.role 
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn } as jwt.SignOptions
    );
  }

  /**
   * Generate a random nonce for authentication
   */
  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Build SIWE (Sign-In with Ethereum) message
   */
  private buildSIWEMessage(params: SIWEMessageParams): string {
    return `SafeDocs wants you to sign in with your Ethereum account:
${params.address}

Welcome to SafeDocs! By signing this message, you agree to authenticate your wallet for secure document management.

URI: ${params.uri}
Version: ${params.version}
Chain ID: ${params.chainId}
Nonce: ${params.nonce}
Issued At: ${params.issuedAt}${params.expirationTime ? `\nExpiration Time: ${params.expirationTime}` : ''}`;
  }

  /**
   * Parse SIWE message to extract data
   */
  private parseSIWEMessage(message: string): Partial<WalletAuthMessage> {
    const lines = message.split('\n');
    const result: Partial<WalletAuthMessage> = {};

    // Extract address (second line)
    if (lines[1]) {
      result.address = lines[1];
    }

    // Extract other fields
    lines.forEach(line => {
      if (line.startsWith('URI: ')) {
        result.uri = line.substring(5);
      } else if (line.startsWith('Version: ')) {
        result.version = line.substring(9);
      } else if (line.startsWith('Chain ID: ')) {
        result.chainId = parseInt(line.substring(10));
      } else if (line.startsWith('Nonce: ')) {
        result.nonce = line.substring(7);
      } else if (line.startsWith('Issued At: ')) {
        result.issuedAt = line.substring(11);
      } else if (line.startsWith('Expiration Time: ')) {
        result.expirationTime = line.substring(17);
      }
    });

    return result;
  }

  /**
   * Get network name from chain ID
   */
  private getNetworkName(chainId: number): string {
    const networks: Record<number, string> = {
      1: 'Ethereum Mainnet',
      5: 'Goerli Testnet',
      11155111: 'Sepolia Testnet',
      314: 'Filecoin Mainnet',
      314159: 'Filecoin Calibration Testnet',
      137: 'Polygon Mainnet',
      80001: 'Polygon Mumbai Testnet',
    };

    return networks[chainId] || `Unknown Network (${chainId})`;
  }

  /**
   * Log authentication events for audit trail
   */
  private async logAuthEvent(userId: string, action: string, details: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: action as any,
          details,
          ipAddress: 'unknown', // This will be updated when we get request context
          userAgent: 'unknown',
          complianceLevel: 'STANDARD',
          retentionDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
        },
      });
    } catch (error) {
      logger.error('Failed to log auth event:', error);
    }
  }
}

export const synapseAuthService = new SynapseAuthService();
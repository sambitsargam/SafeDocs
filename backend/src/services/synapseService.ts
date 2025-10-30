import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const WALLETCONNECT_PROJECT_ID = process.env.WALLETCONNECT_PROJECT_ID || 'demo-project-id';

/**
 * Wallet Authentication Service
 * Handles wallet-based authentication using WalletConnect and Sign-In with Ethereum (SIWE)
 */
export class WalletAuthService {
  private provider: ethers.providers.JsonRpcProvider;

  constructor() {
    // Initialize Filecoin RPC provider
    const rpcUrl = process.env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1';
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    logger.info('Wallet Authentication Service initialized');
  }

  /**
   * Verify wallet signature and authenticate user
   */
  async authenticateWallet(
    walletAddress: string,
    signature: string,
    message: string
  ): Promise<{ token: string; user: any }> {
    try {
      // Verify the signature
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);

      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('Invalid signature');
      }

      // Check if user exists, create if not
      let user = await prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });

      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            walletAddress: walletAddress.toLowerCase(),
            email: `${walletAddress.toLowerCase()}@wallet.safedocs.io`, // Temporary email
            name: `User ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
          },
        });

        logger.info(`New wallet user created: ${walletAddress}`);
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          walletAddress: user.walletAddress,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          name: user.name,
          email: user.email,
        },
      };
    } catch (error) {
      logger.error('Wallet authentication error:', error);
      throw new Error('Failed to authenticate wallet');
    }
  }

  /**
   * Generate authentication message for wallet signing
   */
  generateAuthMessage(walletAddress: string): string {
    const timestamp = Date.now();
    return `SafeDocs Authentication\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\n\nSign this message to authenticate with SafeDocs.`;
  }

  /**
   * Get user's Filecoin balance using Synapse SDK
   */
  async getWalletBalance(walletAddress: string): Promise<string> {
    try {
      const balance = await this.sdk.getBalance(walletAddress);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      logger.error('Error fetching wallet balance:', error);
      throw new Error('Failed to fetch wallet balance');
    }
  }

  /**
   * Store document on Filecoin using Synapse SDK
   */
  async storeDocument(
    documentData: Buffer,
    metadata: {
      name: string;
      hash: string;
      userId: string;
    }
  ): Promise<{ cid: string; dealId?: string }> {
    try {
      // Upload to IPFS/Filecoin using Synapse
      const result = await this.sdk.storage.upload(documentData, {
        name: metadata.name,
        metadata: {
          hash: metadata.hash,
          userId: metadata.userId,
          timestamp: Date.now(),
        },
      });

      logger.info(`Document stored on Filecoin: ${result.cid}`);

      return {
        cid: result.cid,
        dealId: result.dealId,
      };
    } catch (error) {
      logger.error('Error storing document:', error);
      throw new Error('Failed to store document on Filecoin');
    }
  }

  /**
   * Retrieve document from Filecoin using Synapse SDK
   */
  async retrieveDocument(cid: string): Promise<Buffer> {
    try {
      const data = await this.sdk.storage.retrieve(cid);
      return Buffer.from(data);
    } catch (error) {
      logger.error('Error retrieving document:', error);
      throw new Error('Failed to retrieve document from Filecoin');
    }
  }

  /**
   * Verify document integrity using Proof of Data Possession (PDP)
   */
  async verifyDocumentIntegrity(cid: string, expectedHash: string): Promise<boolean> {
    try {
      // Retrieve document
      const document = await this.retrieveDocument(cid);

      // Calculate hash
      const actualHash = ethers.utils.keccak256(document);

      // Compare hashes
      return actualHash === expectedHash;
    } catch (error) {
      logger.error('Error verifying document:', error);
      return false;
    }
  }

  /**
   * Create storage deal for document
   */
  async createStorageDeal(
    cid: string,
    durationDays: number = 180
  ): Promise<{ dealId: string; status: string }> {
    try {
      const deal = await this.sdk.storage.createDeal({
        cid,
        duration: durationDays * 24 * 60 * 60, // Convert days to seconds
        verified: true, // Use Filecoin Plus for verified deals
      });

      logger.info(`Storage deal created: ${deal.dealId}`);

      return {
        dealId: deal.dealId,
        status: deal.status,
      };
    } catch (error) {
      logger.error('Error creating storage deal:', error);
      throw new Error('Failed to create storage deal');
    }
  }

  /**
   * Get storage deal status
   */
  async getDealStatus(dealId: string): Promise<{
    status: string;
    provider: string;
    startEpoch?: number;
    endEpoch?: number;
  }> {
    try {
      const dealInfo = await this.sdk.storage.getDealInfo(dealId);

      return {
        status: dealInfo.status,
        provider: dealInfo.provider,
        startEpoch: dealInfo.startEpoch,
        endEpoch: dealInfo.endEpoch,
      };
    } catch (error) {
      logger.error('Error fetching deal status:', error);
      throw new Error('Failed to fetch deal status');
    }
  }

  /**
   * Initialize wallet for user (for gasless transactions)
   */
  async initializeWallet(userId: string): Promise<{ address: string; mnemonic: string }> {
    try {
      // Create new wallet
      const wallet = ethers.Wallet.createRandom();

      // Store encrypted wallet info in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          walletAddress: wallet.address.toLowerCase(),
        },
      });

      logger.info(`Wallet initialized for user: ${userId}`);

      return {
        address: wallet.address,
        mnemonic: wallet.mnemonic.phrase,
      };
    } catch (error) {
      logger.error('Error initializing wallet:', error);
      throw new Error('Failed to initialize wallet');
    }
  }

  /**
   * Send transaction using Synapse SDK
   */
  async sendTransaction(
    from: string,
    to: string,
    value: string
  ): Promise<{ txHash: string; status: string }> {
    try {
      const tx = await this.sdk.sendTransaction({
        from,
        to,
        value: ethers.utils.parseEther(value),
      });

      logger.info(`Transaction sent: ${tx.hash}`);

      return {
        txHash: tx.hash,
        status: 'pending',
      };
    } catch (error) {
      logger.error('Error sending transaction:', error);
      throw new Error('Failed to send transaction');
    }
  }

  /**
   * Estimate storage cost for document
   */
  async estimateStorageCost(
    fileSizeBytes: number,
    durationDays: number = 180
  ): Promise<{ costFIL: string; costUSD?: string }> {
    try {
      const cost = await this.sdk.storage.estimateCost({
        size: fileSizeBytes,
        duration: durationDays * 24 * 60 * 60,
      });

      return {
        costFIL: ethers.utils.formatEther(cost.fil),
        costUSD: cost.usd?.toString(),
      };
    } catch (error) {
      logger.error('Error estimating storage cost:', error);
      throw new Error('Failed to estimate storage cost');
    }
  }
}

// Export singleton instance
export const synapseService = new SynapseService();

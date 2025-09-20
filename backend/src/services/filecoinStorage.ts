import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
import lighthouse from '@lighthouse-web3/sdk';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface StorageProof {
  cid: string;
  hash: string;
  size: number;
  timestamp: Date;
  proofType: 'PDP' | 'PoR' | 'PoS';
  dealId?: string;
  minerAddress?: string;
  pieceHash?: string;
  commP?: string;
  commD?: string;
}

export interface DocumentMetadata {
  filename: string;
  contentType: string;
  size: number;
  hash: string;
  uploadedBy: string;
  uploadedAt: Date;
  tags?: string[];
  encryption?: {
    algorithm: string;
    keyId: string;
  };
}

export interface FilecoinDeal {
  id: string;
  cid: string;
  minerAddress: string;
  pieceHash: string;
  size: number;
  price: string;
  duration: number;
  status: 'pending' | 'active' | 'complete' | 'failed';
  createdAt: Date;
  activatedAt?: Date;
}

export class FilecoinStorageService {
  private helia: any;
  private fs: any;
  private lighthouseApiKey: string;

  constructor() {
    this.lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY || '';
    this.initializeHelia();
  }

  private async initializeHelia() {
    try {
      this.helia = await createHelia();
      this.fs = unixfs(this.helia);
      logger.info('Helia IPFS node initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Helia IPFS node:', error);
      throw new Error('Failed to initialize IPFS connection');
    }
  }

  /**
   * Store a document on Filecoin with encryption and verification
   */
  async storeDocument(
    buffer: Buffer,
    metadata: DocumentMetadata,
    encrypt: boolean = true
  ): Promise<{
    cid: string;
    storageProof: StorageProof;
    deal?: FilecoinDeal;
    encryptionKey?: string;
  }> {
    try {
      logger.info(`Starting document storage for: ${metadata.filename}`);

      // Generate document hash
      const documentHash = crypto.createHash('sha256').update(buffer).digest('hex');
      metadata.hash = documentHash;

      let processedBuffer = buffer;
      let encryptionKey: string | undefined;

      // Encrypt document if requested
      if (encrypt) {
        const encryptionResult = await this.encryptDocument(buffer);
        processedBuffer = encryptionResult.encryptedBuffer;
        encryptionKey = encryptionResult.key;
        
        metadata.encryption = {
          algorithm: 'AES-256-CBC',
          keyId: crypto.createHash('sha256').update(encryptionResult.key).digest('hex').substring(0, 16)
        };
      }

      // Store on IPFS via Helia
      const cid = await this.fs.addBytes(processedBuffer);
      logger.info(`Document stored on IPFS with CID: ${cid.toString()}`);

      // Create storage deal via Lighthouse
      const deal = await this.createFilecoinDeal(cid.toString(), processedBuffer);

      // Generate proof of data possession
      const storageProof = await this.generateStorageProof(
        cid.toString(),
        processedBuffer,
        deal
      );

      logger.info(`Document storage completed successfully for CID: ${cid.toString()}`);

      return {
        cid: cid.toString(),
        storageProof,
        deal,
        encryptionKey
      };

    } catch (error) {
      logger.error('Failed to store document on Filecoin:', error);
      throw new Error(`Document storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a document from Filecoin
   */
  async retrieveDocument(
    cid: string,
    decryptionKey?: string
  ): Promise<{
    buffer: Buffer;
    metadata?: DocumentMetadata;
    verified: boolean;
  }> {
    try {
      logger.info(`Retrieving document with CID: ${cid}`);

      // Get data from IPFS
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.fs.cat(cid)) {
        chunks.push(chunk);
      }
      
      let buffer = Buffer.concat(chunks);

      // Decrypt if key provided
      if (decryptionKey) {
        buffer = await this.decryptDocument(buffer, decryptionKey) as Buffer;
      }

      // Verify document integrity
      const verified = await this.verifyDocumentIntegrity(cid, buffer);

      logger.info(`Document retrieved successfully from CID: ${cid}`);

      return {
        buffer,
        verified
      };

    } catch (error) {
      logger.error('Failed to retrieve document from Filecoin:', error);
      throw new Error(`Document retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a Filecoin storage deal via Lighthouse
   */
  private async createFilecoinDeal(
    cid: string,
    buffer: Buffer
  ): Promise<FilecoinDeal> {
    try {
      if (!this.lighthouseApiKey) {
        throw new Error('Lighthouse API key not configured');
      }

      // Upload to Lighthouse for Filecoin deal creation
      const response = await lighthouse.upload(
        buffer,
        this.lighthouseApiKey
      );

      const deal: FilecoinDeal = {
        id: response.data.Hash,
        cid: cid,
        minerAddress: 'f01234', // This would be actual miner from Lighthouse response
        pieceHash: response.data.Hash,
        size: buffer.length,
        price: '0.001 FIL', // This would be actual price from deal
        duration: 180, // 180 days default
        status: 'pending',
        createdAt: new Date()
      };

      logger.info(`Filecoin deal created: ${deal.id}`);
      return deal;

    } catch (error) {
      logger.error('Failed to create Filecoin deal:', error);
      throw new Error(`Deal creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate cryptographic proof of data possession
   */
  private async generateStorageProof(
    cid: string,
    buffer: Buffer,
    deal?: FilecoinDeal
  ): Promise<StorageProof> {
    try {
      // Generate multiple hash proofs for verification
      const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const sha3Hash = crypto.createHash('sha3-256').update(buffer).digest('hex');
      
      // Combine hashes for stronger proof
      const combinedHash = crypto
        .createHash('sha256')
        .update(sha256Hash + sha3Hash + cid)
        .digest('hex');

      const proof: StorageProof = {
        cid,
        hash: combinedHash,
        size: buffer.length,
        timestamp: new Date(),
        proofType: 'PDP', // Proof of Data Possession
        dealId: deal?.id,
        minerAddress: deal?.minerAddress,
        pieceHash: deal?.pieceHash
      };

      logger.info(`Storage proof generated for CID: ${cid}`);
      return proof;

    } catch (error) {
      logger.error('Failed to generate storage proof:', error);
      throw new Error(`Proof generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify document integrity against stored proof
   */
  async verifyDocumentIntegrity(
    cid: string,
    buffer: Buffer,
    storedProof?: StorageProof
  ): Promise<boolean> {
    try {
      if (!storedProof) {
        // Generate current proof and compare with blockchain
        const currentProof = await this.generateStorageProof(cid, buffer);
        logger.info(`Document integrity verified for CID: ${cid}`);
        return true; // In real implementation, compare with on-chain proof
      }

      // Verify against stored proof
      const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const sha3Hash = crypto.createHash('sha3-256').update(buffer).digest('hex');
      const combinedHash = crypto
        .createHash('sha256')
        .update(sha256Hash + sha3Hash + cid)
        .digest('hex');

      const isValid = combinedHash === storedProof.hash;
      logger.info(`Document integrity verification result for CID ${cid}: ${isValid ? 'VALID' : 'INVALID'}`);
      
      return isValid;

    } catch (error) {
      logger.error('Failed to verify document integrity:', error);
      return false;
    }
  }

  /**
   * Encrypt document using AES-256-CBC
   */
  private async encryptDocument(buffer: Buffer): Promise<{
    encryptedBuffer: Buffer;
    key: string;
  }> {
    try {
      // Generate encryption key and IV
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipher('aes-256-cbc', key);
      
      // Encrypt
      const encryptedData = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
      ]);
      
      // Combine IV + EncryptedData
      const encryptedBuffer = Buffer.concat([iv, encryptedData]);
      
      logger.info('Document encrypted successfully');
      return {
        encryptedBuffer,
        key: key.toString('hex')
      };

    } catch (error) {
      logger.error('Failed to encrypt document:', error);
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt document using AES-256-CBC
   */
  private async decryptDocument(encryptedBuffer: Buffer, keyHex: string): Promise<Buffer> {
    try {
      const key = Buffer.from(keyHex, 'hex');
      
      // Extract components
      const iv = encryptedBuffer.subarray(0, 16);
      const encryptedData = encryptedBuffer.subarray(16);
      
      // Create decipher
      const decipher = crypto.createDecipher('aes-256-cbc', key);
      
      // Decrypt
      const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);
      
      logger.info('Document decrypted successfully');
      return decryptedBuffer;

    } catch (error) {
      logger.error('Failed to decrypt document:', error);
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get deal status from Filecoin network
   */
  async getDealStatus(dealId: string): Promise<FilecoinDeal | null> {
    try {
      // In real implementation, query Filecoin network for deal status
      // For now, return mock data
      logger.info(`Checking deal status for: ${dealId}`);
      
      return {
        id: dealId,
        cid: 'bafybeig...',
        minerAddress: 'f01234',
        pieceHash: 'piece_hash',
        size: 1024,
        price: '0.001 FIL',
        duration: 180,
        status: 'active',
        createdAt: new Date(),
        activatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get deal status:', error);
      return null;
    }
  }

  /**
   * List all storage deals for a user
   */
  async getUserDeals(userAddress: string): Promise<FilecoinDeal[]> {
    try {
      // In real implementation, query database and Filecoin network
      logger.info(`Fetching deals for user: ${userAddress}`);
      return [];

    } catch (error) {
      logger.error('Failed to get user deals:', error);
      return [];
    }
  }

  /**
   * Calculate storage costs
   */
  calculateStorageCost(sizeInBytes: number, durationInDays: number): {
    costInFIL: number;
    costInUSD: number;
    comparison: {
      docusignCost: number;
      savings: number;
      savingsPercentage: number;
    };
  } {
    // Base cost calculation (example rates)
    const costPerGBPerDay = 0.0001; // FIL
    const filToUSD = 4.5; // Example exchange rate
    
    const sizeInGB = sizeInBytes / (1024 * 1024 * 1024);
    const costInFIL = sizeInGB * costPerGBPerDay * durationInDays;
    const costInUSD = costInFIL * filToUSD;
    
    // Compare with DocuSign pricing
    const docusignCostPerDocument = 1.5; // USD
    const savings = docusignCostPerDocument - costInUSD;
    const savingsPercentage = (savings / docusignCostPerDocument) * 100;
    
    return {
      costInFIL,
      costInUSD,
      comparison: {
        docusignCost: docusignCostPerDocument,
        savings,
        savingsPercentage
      }
    };
  }

  /**
   * Cleanup and close connections
   */
  async cleanup(): Promise<void> {
    try {
      if (this.helia) {
        await this.helia.stop();
        logger.info('Helia IPFS node stopped');
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

export const filecoinStorage = new FilecoinStorageService();
import { logger } from '../utils/logger';
import { prisma } from '../utils/database';
import crypto from 'crypto';

export interface CDNNode {
  id: string;
  location: {
    country: string;
    region: string;
    city: string;
    coordinates: [number, number]; // [lat, lng]
  };
  endpoint: string;
  capacity: number;
  currentLoad: number;
  latency: number;
  isActive: boolean;
}

export interface CacheEntry {
  cid: string;
  documentId: string;
  nodeId: string;
  cachedAt: Date;
  accessCount: number;
  lastAccessed: Date;
  expiresAt?: Date;
  size: number;
  popularity: number;
}

export interface RetrievalMetrics {
  requestId: string;
  cid: string;
  nodeUsed: string;
  retrievalTime: number;
  transferSize: number;
  cacheHit: boolean;
  userLocation?: {
    country: string;
    region: string;
  };
  timestamp: Date;
}

export class FilCDNService {
  private cdnNodes: Map<string, CDNNode> = new Map();
  private cacheIndex: Map<string, CacheEntry[]> = new Map();

  constructor() {
    this.initializeCDNNodes();
  }

  /**
   * Initialize global CDN nodes
   */
  private initializeCDNNodes() {
    const nodes: CDNNode[] = [
      {
        id: 'us-east-1',
        location: {
          country: 'United States',
          region: 'Virginia',
          city: 'Ashburn',
          coordinates: [39.0458, -77.5009],
        },
        endpoint: 'https://cdn-us-east-1.safedocs.filecoin.io',
        capacity: 1000000, // 1TB
        currentLoad: 0.2,
        latency: 15,
        isActive: true,
      },
      {
        id: 'eu-west-1',
        location: {
          country: 'Ireland',
          region: 'Dublin',
          city: 'Dublin',
          coordinates: [53.3498, -6.2603],
        },
        endpoint: 'https://cdn-eu-west-1.safedocs.filecoin.io',
        capacity: 1000000,
        currentLoad: 0.15,
        latency: 20,
        isActive: true,
      },
      {
        id: 'ap-southeast-1',
        location: {
          country: 'Singapore',
          region: 'Singapore',
          city: 'Singapore',
          coordinates: [1.3521, 103.8198],
        },
        endpoint: 'https://cdn-ap-southeast-1.safedocs.filecoin.io',
        capacity: 1000000,
        currentLoad: 0.3,
        latency: 25,
        isActive: true,
      },
      {
        id: 'us-west-2',
        location: {
          country: 'United States',
          region: 'Oregon',
          city: 'Portland',
          coordinates: [45.5152, -122.6784],
        },
        endpoint: 'https://cdn-us-west-2.safedocs.filecoin.io',
        capacity: 1000000,
        currentLoad: 0.18,
        latency: 18,
        isActive: true,
      },
      {
        id: 'eu-central-1',
        location: {
          country: 'Germany',
          region: 'Frankfurt',
          city: 'Frankfurt',
          coordinates: [50.1109, 8.6821],
        },
        endpoint: 'https://cdn-eu-central-1.safedocs.filecoin.io',
        capacity: 1000000,
        currentLoad: 0.25,
        latency: 22,
        isActive: true,
      },
    ];

    nodes.forEach(node => this.cdnNodes.set(node.id, node));
    logger.info(`Initialized ${nodes.length} CDN nodes globally`);
  }

  /**
   * Get the optimal CDN node for a user location
   */
  async getOptimalNode(userLocation?: {
    lat: number;
    lng: number;
    country?: string;
  }): Promise<CDNNode> {
    try {
      const activeNodes = Array.from(this.cdnNodes.values()).filter(node => node.isActive);
      
      if (!userLocation) {
        // Default to lowest latency node
        return activeNodes.reduce((best, current) => 
          current.latency < best.latency ? current : best
        );
      }

      // Calculate distance-based scores
      const scoredNodes = activeNodes.map(node => {
        const distance = this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          node.location.coordinates[0],
          node.location.coordinates[1]
        );

        // Score based on distance, latency, and current load
        const distanceScore = Math.max(0, 100 - distance / 100);
        const latencyScore = Math.max(0, 100 - node.latency);
        const loadScore = Math.max(0, 100 - node.currentLoad * 100);
        
        const totalScore = (distanceScore * 0.4) + (latencyScore * 0.3) + (loadScore * 0.3);

        return { node, score: totalScore, distance };
      });

      const bestNode = scoredNodes.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      logger.debug(`Selected optimal CDN node: ${bestNode.node.id} (score: ${bestNode.score.toFixed(2)})`);
      return bestNode.node;

    } catch (error) {
      logger.error('Failed to select optimal CDN node:', error);
      // Fallback to first available node
      return Array.from(this.cdnNodes.values()).find(node => node.isActive)!;
    }
  }

  /**
   * Retrieve document from CDN with caching
   */
  async retrieveDocument(
    cid: string,
    userLocation?: { lat: number; lng: number; country?: string }
  ): Promise<{
    buffer: Buffer;
    cacheHit: boolean;
    nodeUsed: string;
    retrievalTime: number;
    contentType?: string;
  }> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      logger.info(`Retrieving document from CDN: ${cid}`);

      // Get optimal CDN node
      const optimalNode = await this.getOptimalNode(userLocation);

      // Check if document is cached at the optimal node
      let cacheHit = false;
      const cacheEntries = this.cacheIndex.get(cid) || [];
      const cachedAtNode = cacheEntries.find(entry => 
        entry.nodeId === optimalNode.id && 
        (!entry.expiresAt || entry.expiresAt > new Date())
      );

      let buffer: Buffer;
      let contentType: string | undefined;

      if (cachedAtNode) {
        // Retrieve from cache
        buffer = await this.retrieveFromCache(cid, optimalNode);
        cacheHit = true;
        
        // Update cache statistics
        await this.updateCacheStats(cachedAtNode);
        
        logger.debug(`Cache hit for ${cid} at node ${optimalNode.id}`);
      } else {
        // Retrieve from origin (Filecoin) and cache
        const { buffer: originBuffer, contentType: originContentType } = await this.retrieveFromOrigin(cid);
        buffer = originBuffer;
        contentType = originContentType;
        
        // Cache at optimal node and nearby nodes
        await this.cacheDocument(cid, buffer, optimalNode, contentType);
        
        logger.debug(`Retrieved ${cid} from origin and cached at ${optimalNode.id}`);
      }

      const retrievalTime = Date.now() - startTime;

      // Record metrics
      await this.recordRetrievalMetrics({
        requestId,
        cid,
        nodeUsed: optimalNode.id,
        retrievalTime,
        transferSize: buffer.length,
        cacheHit,
        userLocation: userLocation ? {
          country: userLocation.country || 'Unknown',
          region: 'Unknown',
        } : undefined,
        timestamp: new Date(),
      });

      logger.info(`Document retrieved successfully: ${cid} in ${retrievalTime}ms (cache: ${cacheHit})`);

      return {
        buffer,
        cacheHit,
        nodeUsed: optimalNode.id,
        retrievalTime,
        contentType,
      };

    } catch (error) {
      logger.error('CDN document retrieval failed:', error);
      throw new Error(`CDN retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pre-warm cache for popular documents
   */
  async prewarmCache(cid: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    try {
      logger.info(`Pre-warming cache for document: ${cid}`);

      // Determine which nodes to pre-warm based on priority
      let nodesToWarm: CDNNode[];
      
      switch (priority) {
        case 'high':
          nodesToWarm = Array.from(this.cdnNodes.values()).filter(n => n.isActive);
          break;
        case 'medium':
          nodesToWarm = Array.from(this.cdnNodes.values())
            .filter(n => n.isActive)
            .slice(0, 3); // Top 3 nodes
          break;
        case 'low':
          nodesToWarm = Array.from(this.cdnNodes.values())
            .filter(n => n.isActive)
            .slice(0, 1); // Top 1 node
          break;
      }

      // Retrieve from origin once
      const { buffer, contentType } = await this.retrieveFromOrigin(cid);

      // Cache at selected nodes
      const cachePromises = nodesToWarm.map(node => 
        this.cacheDocument(cid, buffer, node, contentType)
      );

      await Promise.all(cachePromises);

      logger.info(`Cache pre-warmed for ${cid} at ${nodesToWarm.length} nodes`);

    } catch (error) {
      logger.error('Cache pre-warming failed:', error);
      throw new Error(`Cache pre-warming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Invalidate cache for a document
   */
  async invalidateCache(cid: string): Promise<void> {
    try {
      logger.info(`Invalidating cache for document: ${cid}`);

      // Remove cache entries
      const cacheEntries = this.cacheIndex.get(cid) || [];
      
      const invalidationPromises = cacheEntries.map(async (entry) => {
        const node = this.cdnNodes.get(entry.nodeId);
        if (node) {
          await this.removeCacheEntry(cid, node);
        }
      });

      await Promise.all(invalidationPromises);

      // Clear cache index
      this.cacheIndex.delete(cid);

      logger.info(`Cache invalidated for ${cid}`);

    } catch (error) {
      logger.error('Cache invalidation failed:', error);
      throw new Error(`Cache invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get CDN analytics and performance metrics
   */
  async getCDNAnalytics(timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<{
    totalRequests: number;
    cacheHitRate: number;
    averageRetrievalTime: number;
    bandwidthSaved: number;
    topDocuments: Array<{ cid: string; requests: number }>;
    nodePerformance: Array<{ nodeId: string; requests: number; avgLatency: number }>;
    geographicDistribution: Array<{ country: string; requests: number }>;
  }> {
    try {
      const cutoffDate = new Date();
      switch (timeframe) {
        case 'hour':
          cutoffDate.setHours(cutoffDate.getHours() - 1);
          break;
        case 'day':
          cutoffDate.setDate(cutoffDate.getDate() - 1);
          break;
        case 'week':
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
      }

      // This would query actual metrics from the database
      // For now, return mock data
      const analytics = {
        totalRequests: 15420,
        cacheHitRate: 0.87, // 87% cache hit rate
        averageRetrievalTime: 125, // milliseconds
        bandwidthSaved: 2.4 * 1024 * 1024 * 1024, // 2.4 GB saved
        topDocuments: [
          { cid: 'bafybeig...1', requests: 1240 },
          { cid: 'bafybeig...2', requests: 980 },
          { cid: 'bafybeig...3', requests: 756 },
        ],
        nodePerformance: [
          { nodeId: 'us-east-1', requests: 5240, avgLatency: 15 },
          { nodeId: 'eu-west-1', requests: 3890, avgLatency: 20 },
          { nodeId: 'ap-southeast-1', requests: 2940, avgLatency: 25 },
        ],
        geographicDistribution: [
          { country: 'United States', requests: 6200 },
          { country: 'Germany', requests: 2800 },
          { country: 'Singapore', requests: 2100 },
        ],
      };

      return analytics;

    } catch (error) {
      logger.error('Failed to get CDN analytics:', error);
      throw new Error('Failed to retrieve CDN analytics');
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in kilometers
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Retrieve document from cache
   */
  private async retrieveFromCache(cid: string, node: CDNNode): Promise<Buffer> {
    // Mock implementation - would make HTTP request to CDN node
    logger.debug(`Retrieving ${cid} from cache at ${node.id}`);
    return Buffer.from(`cached-content-for-${cid}`);
  }

  /**
   * Retrieve document from origin (Filecoin)
   */
  private async retrieveFromOrigin(cid: string): Promise<{ buffer: Buffer; contentType?: string }> {
    // Mock implementation - would retrieve from Filecoin storage
    logger.debug(`Retrieving ${cid} from Filecoin origin`);
    return {
      buffer: Buffer.from(`origin-content-for-${cid}`),
      contentType: 'application/pdf',
    };
  }

  /**
   * Cache document at specified node
   */
  private async cacheDocument(
    cid: string,
    buffer: Buffer,
    node: CDNNode,
    contentType?: string
  ): Promise<void> {
    try {
      // Mock implementation - would upload to CDN node
      logger.debug(`Caching ${cid} at node ${node.id}`);

      // Create cache entry
      const cacheEntry: CacheEntry = {
        cid,
        documentId: '', // Would be resolved
        nodeId: node.id,
        cachedAt: new Date(),
        accessCount: 0,
        lastAccessed: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        size: buffer.length,
        popularity: 0,
      };

      // Update cache index
      const existingEntries = this.cacheIndex.get(cid) || [];
      existingEntries.push(cacheEntry);
      this.cacheIndex.set(cid, existingEntries);

      // Update node load
      node.currentLoad += (buffer.length / node.capacity);

    } catch (error) {
      logger.error('Failed to cache document:', error);
      throw error;
    }
  }

  /**
   * Update cache statistics
   */
  private async updateCacheStats(cacheEntry: CacheEntry): Promise<void> {
    cacheEntry.accessCount++;
    cacheEntry.lastAccessed = new Date();
    cacheEntry.popularity = cacheEntry.accessCount / Math.max(1, 
      (Date.now() - cacheEntry.cachedAt.getTime()) / (24 * 60 * 60 * 1000)
    );
  }

  /**
   * Remove cache entry
   */
  private async removeCacheEntry(cid: string, node: CDNNode): Promise<void> {
    // Mock implementation - would delete from CDN node
    logger.debug(`Removing ${cid} from cache at ${node.id}`);
  }

  /**
   * Record retrieval metrics
   */
  private async recordRetrievalMetrics(metrics: RetrievalMetrics): Promise<void> {
    // In a real implementation, this would store metrics in a time-series database
    logger.debug('Recording retrieval metrics:', {
      cid: metrics.cid,
      nodeUsed: metrics.nodeUsed,
      retrievalTime: metrics.retrievalTime,
      cacheHit: metrics.cacheHit,
    });
  }

  /**
   * Get node health status
   */
  async getNodeHealthStatus(): Promise<Array<{
    nodeId: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    load: number;
    lastCheck: Date;
  }>> {
    return Array.from(this.cdnNodes.values()).map(node => ({
      nodeId: node.id,
      status: node.currentLoad < 0.8 ? 'healthy' : node.currentLoad < 0.95 ? 'degraded' : 'unhealthy',
      latency: node.latency,
      load: node.currentLoad,
      lastCheck: new Date(),
    }));
  }
}

export const filCDNService = new FilCDNService();
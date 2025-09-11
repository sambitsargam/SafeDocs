import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSchema } from 'type-graphql';
import dotenv from 'dotenv';

import { AuthController } from './controllers/AuthController';
import { DocumentController } from './controllers/DocumentController';
import { SigningController } from './controllers/SigningController';
import { ComplianceController } from './controllers/ComplianceController';

import { FilecoinService } from './services/FilecoinService';
import { SynapseService } from './services/SynapseService';
import { EncryptionService } from './services/EncryptionService';

import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

class SafeDocsApp {
  private app: express.Application;
  private apolloServer: ApolloServer;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupGraphQL();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/auth', AuthController);
    this.app.use('/api/documents', authMiddleware, DocumentController);
    this.app.use('/api/signing', authMiddleware, SigningController);
    this.app.use('/api/compliance', authMiddleware, ComplianceController);

    // File upload endpoint
    this.app.post('/api/upload', authMiddleware, (req, res) => {
      // Multer file upload handling
      res.json({ message: 'File upload endpoint' });
    });
  }

  private async setupGraphQL(): Promise<void> {
    try {
      const schema = await buildSchema({
        resolvers: [
          // Add resolvers here when implementing GraphQL
        ],
        validate: false
      });

      this.apolloServer = new ApolloServer({
        schema,
        introspection: process.env.NODE_ENV !== 'production',
        formatError: (error) => {
          logger.error('GraphQL Error:', error);
          return {
            message: error.message,
            code: error.extensions?.code,
            path: error.path
          };
        }
      });

      await this.apolloServer.start();

      this.app.use('/graphql', expressMiddleware(this.apolloServer, {
        context: async ({ req }) => ({
          user: req.user,
          req
        })
      }));

      logger.info('GraphQL server setup complete');
    } catch (error) {
      logger.error('Failed to setup GraphQL:', error);
    }
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    const port = process.env.PORT || 8000;

    try {
      // Initialize services
      await this.initializeServices();

      this.app.listen(port, () => {
        logger.info(`SafeDocs API server running on port ${port}`);
        logger.info(`GraphQL endpoint: http://localhost:${port}/graphql`);
        logger.info(`Health check: http://localhost:${port}/health`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize Filecoin service
      await FilecoinService.initialize();
      logger.info('Filecoin service initialized');

      // Initialize Synapse service
      await SynapseService.initialize();
      logger.info('Synapse service initialized');

      // Initialize encryption service
      await EncryptionService.initialize();
      logger.info('Encryption service initialized');

    } catch (error) {
      logger.error('Service initialization failed:', error);
      throw error;
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Start the application
if (require.main === module) {
  const app = new SafeDocsApp();
  app.start().catch((error) => {
    logger.error('Application startup failed:', error);
    process.exit(1);
  });
}

export default SafeDocsApp;

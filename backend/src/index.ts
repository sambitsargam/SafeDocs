import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { createContext } from './middleware/context';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { logger } from './utils/logger';
import { prisma } from './utils/database';
import authRoutes from './routes/auth';
import { documentRoutes } from './routes/documents';
import verificationRoutes from './routes/verification';
import complianceRoutes from './routes/compliance';
import teamRoutes from './routes/teams';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    // Create Express app
    const app = express();

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    }));

    // Logging middleware
    app.use(morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) }
    }));

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
      });
    });

    // Create Apollo Server
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: createContext,
      introspection: NODE_ENV !== 'production',
      debug: NODE_ENV !== 'production',
      formatError: (error) => {
        logger.error('GraphQL Error:', error);
        return {
          message: error.message,
          code: error.extensions?.code,
          path: error.path,
          ...(NODE_ENV !== 'production' && { stack: error.stack }),
        };
      },
    });

    // Start Apollo Server
    await server.start();

    // Apply Apollo GraphQL middleware
    server.applyMiddleware({ 
      app: app as any, 
      path: '/graphql',
      cors: false, // We handle CORS above
    });

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/documents', documentRoutes);
    app.use('/api/verification', verificationRoutes);
    app.use('/api/compliance', complianceRoutes);
    app.use('/api/teams', teamRoutes);
    app.use('/api', authMiddleware);
    
    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Create HTTP server
    const httpServer = createServer(app);

    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server ready at http://localhost:${PORT}`);
      logger.info(`🚀 GraphQL endpoint at http://localhost:${PORT}${server.graphqlPath}`);
      logger.info(`📊 Health check at http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${NODE_ENV}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('🛑 SIGTERM received, shutting down gracefully');
      await server.stop();
      await prisma.$disconnect();
      httpServer.close(() => {
        logger.info('🛑 Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('🛑 SIGINT received, shutting down gracefully');
      await server.stop();
      await prisma.$disconnect();
      httpServer.close(() => {
        logger.info('🛑 Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

startServer();
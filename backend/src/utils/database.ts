import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Singleton pattern for Prisma client
class DatabaseService {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new PrismaClient({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' },
        ],
      });

      // Log database queries in development
      if (process.env.NODE_ENV === 'development') {
        DatabaseService.instance.$on('query', (e) => {
          logger.debug('Database Query:', {
            query: e.query,
            params: e.params,
            duration: `${e.duration}ms`,
          });
        });
      }

      // Log database errors
      DatabaseService.instance.$on('error', (e) => {
        logger.error('Database Error:', e);
      });

      // Log database info
      DatabaseService.instance.$on('info', (e) => {
        logger.info('Database Info:', e);
      });

      // Log database warnings
      DatabaseService.instance.$on('warn', (e) => {
        logger.warn('Database Warning:', e);
      });
    }

    return DatabaseService.instance;
  }

  static async disconnect(): Promise<void> {
    if (DatabaseService.instance) {
      await DatabaseService.instance.$disconnect();
    }
  }
}

export const prisma = DatabaseService.getInstance();
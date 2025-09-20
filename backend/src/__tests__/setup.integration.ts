// Integration test setup
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/safedocs_test';

// Global test setup for integration tests
beforeAll(async () => {
  // Setup test database connection
  console.log('Setting up integration test environment...');
  
  // In a real implementation, you would:
  // 1. Setup test database
  // 2. Run migrations
  // 3. Seed test data
  // 4. Setup test blockchain/IPFS nodes
});

afterAll(async () => {
  // Cleanup test environment
  console.log('Cleaning up integration test environment...');
  
  // In a real implementation, you would:
  // 1. Clean up test database
  // 2. Close connections
  // 3. Clean up test files
});

// Global timeout for integration tests
jest.setTimeout(30000);
import { beforeAll } from 'vitest';
import { sqlLoader } from '../infrastructure/sql-loader';

// Setup for all tests
beforeAll(() => {
    // Load SQL queries for schema validation tests
    sqlLoader.loadAllQueries();
    console.log('🧪 Test setup: SQL queries loaded for schema validation');
});

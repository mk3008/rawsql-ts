import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

// Use query string directly for demonstration instead of parsing it first
const sql = `SELECT id, name FROM users WHERE active = true`;
// Directly pass the string query to the injector
const injectedQuery = new SqlParamInjector().inject(sql, { id: 42, name: 'Alice' });

// Format SQL and extract parameters
const { formattedSql, params } = new SqlFormatter().format(injectedQuery);

console.log(formattedSql);
// Expected output: SELECT id, name FROM users WHERE active = true AND id = :id AND name = :name

console.log(params);
// Expected output: { id: 42, name: 'Alice' }

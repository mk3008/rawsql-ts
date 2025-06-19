import { describe, it, expect } from 'vitest';
import { SqlFileNotFoundError, JsonMappingError, SqlExecutionError } from '../src/RawSqlClient';

describe('Enhanced Error Classes', () => {
    describe('SqlFileNotFoundError', () => {
        it('should create error with proper structure and helpful message', () => {
            const error = new SqlFileNotFoundError(
                'users/profile.sql', 
                '/project/sql/users/profile.sql',
                '/project/sql/users/profile.sql'
            );

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(SqlFileNotFoundError);
            expect(error.name).toBe('SqlFileNotFoundError');
            expect(error.filename).toBe('users/profile.sql');
            expect(error.searchedPath).toBe('/project/sql/users/profile.sql');
            expect(error.suggestedPath).toBe('/project/sql/users/profile.sql');

            // Check message content
            expect(error.message).toContain("SQL file not found: 'users/profile.sql'");
            expect(error.message).toContain('Searched in: /project/sql/users/profile.sql');
            expect(error.message).toContain('Suggestions:');
            expect(error.message).toContain('Check if the file exists at the specified path');
            expect(error.message).toContain('Verify the sqlFilesPath configuration');
            expect(error.message).toContain('Ensure the file has the correct extension (.sql)');
        });

        it('should include helpful suggestions for nested paths', () => {
            const error = new SqlFileNotFoundError(
                'users/admin/special.sql', 
                '/project/sql/users/admin/special.sql'
            );

            expect(error.message).toContain('Check if parent directories exist');
        });
    });

    describe('JsonMappingError', () => {
        it('should create error with proper structure and helpful message', () => {
            const error = new JsonMappingError(
                'profile.json',
                '/project/sql/profile.json',
                'Invalid JSON syntax: Unexpected token } in JSON'
            );

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(JsonMappingError);
            expect(error.name).toBe('JsonMappingError');
            expect(error.filename).toBe('profile.json');
            expect(error.filePath).toBe('/project/sql/profile.json');
            expect(error.issue).toBe('Invalid JSON syntax: Unexpected token } in JSON');

            // Check message content
            expect(error.message).toContain("Invalid JSON mapping file: 'profile.json'");
            expect(error.message).toContain('Location: /project/sql/profile.json');
            expect(error.message).toContain('Issue: Invalid JSON syntax: Unexpected token } in JSON');
            expect(error.message).toContain('Expected format:');
            expect(error.message).toContain('"resultFormat": "object" | "array"');
            expect(error.message).toContain('"rootAlias": "string"');
            expect(error.message).toContain('"columns": { "field": "column_alias" }');
        });

        it('should include original error details when provided', () => {
            const originalError = new SyntaxError('Unexpected token } in JSON at position 10');
            const error = new JsonMappingError(
                'profile.json',
                '/project/sql/profile.json',
                'Parse failed',
                originalError
            );

            expect(error.message).toContain('Original error: Unexpected token } in JSON at position 10');
        });
    });

    describe('SqlExecutionError', () => {
        it('should create error with proper structure and helpful message', () => {
            const sql = 'SELECT id, invalid_column FROM users WHERE id = $1';
            const parameters = [123];
            const databaseError = 'column "invalid_column" does not exist';

            const error = new SqlExecutionError(sql, parameters, databaseError);

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(SqlExecutionError);
            expect(error.name).toBe('SqlExecutionError');
            expect(error.sql).toBe(sql);
            expect(error.parameters).toEqual(parameters);
            expect(error.databaseError).toBe(databaseError);

            // Check message content
            expect(error.message).toContain('SQL query execution failed');
            expect(error.message).toContain('SQL: SELECT id, invalid_column FROM users WHERE id = $1');
            expect(error.message).toContain('Parameters: [123]');
            expect(error.message).toContain('Database Error: column "invalid_column" does not exist');
            expect(error.message).toContain('Suggestions:');
            expect(error.message).toContain('Check if all referenced tables and columns exist');
            expect(error.message).toContain('Verify parameter types match expected database types');
        });

        it('should truncate very long SQL queries', () => {
            const longSql = 'SELECT ' + 'very_long_column_name, '.repeat(50) + 'id FROM users';
            const error = new SqlExecutionError(longSql, [], 'syntax error');

            expect(error.message).toContain('SQL: SELECT very_long_column_name,');
            expect(error.message).toContain('...');
        });

        it('should handle empty parameters gracefully', () => {
            const error = new SqlExecutionError(
                'SELECT * FROM users', 
                [], 
                'table "users" does not exist'
            );

            expect(error.message).toContain('Parameters: []');
            expect(error.message).not.toContain('Ensure parameter count matches placeholders');
        });

        it('should include parameter suggestions when parameters are present', () => {
            const error = new SqlExecutionError(
                'SELECT * FROM users WHERE id = $1', 
                ['invalid'], 
                'invalid input syntax for type integer'
            );

            expect(error.message).toContain('Ensure parameter count matches placeholders in SQL');
        });
    });

    describe('Error message consistency', () => {
        it('should all have proper error names', () => {
            const sqlError = new SqlFileNotFoundError('test.sql', '/path/test.sql');
            const jsonError = new JsonMappingError('test.json', '/path/test.json', 'issue');
            const execError = new SqlExecutionError('SELECT 1', [], 'error');

            expect(sqlError.name).toBe('SqlFileNotFoundError');
            expect(jsonError.name).toBe('JsonMappingError');
            expect(execError.name).toBe('SqlExecutionError');
        });

        it('should all extend Error properly', () => {
            const sqlError = new SqlFileNotFoundError('test.sql', '/path/test.sql');
            const jsonError = new JsonMappingError('test.json', '/path/test.json', 'issue');
            const execError = new SqlExecutionError('SELECT 1', [], 'error');

            expect(sqlError instanceof Error).toBe(true);
            expect(jsonError instanceof Error).toBe(true);
            expect(execError instanceof Error).toBe(true);
        });
    });
});
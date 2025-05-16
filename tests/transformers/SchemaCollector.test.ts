import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SchemaCollector } from '../../src/transformers/SchemaCollector';
// Test cases for SchemaCollector

describe('SchemaCollector', () => {
    test('collects schema information from simple SELECT query', () => {
        // Arrange
        const sql = `SELECT u.id, u.name FROM users as u`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
    });
});

import { describe, expect, test } from 'vitest';
import { ColumnReferenceCollector } from '../../src/transformers/ColumnReferenceCollector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { ColumnReference, RawString } from '../../src/models/ValueComponent';

const getColumnName = (column: ColumnReference): string => {
    const nameComponent = column.qualifiedName.name;
    if (nameComponent instanceof RawString) {
        return nameComponent.value;
    }
    return nameComponent.name;
};

describe('ColumnReferenceCollector', () => {
    test('captures columns referenced inside FILTER predicates of aggregates', () => {
        // Arrange: Use an aggregate with FILTER clause that touches a separate column.
        const sql = `SELECT SUM(amount) FILTER (WHERE region = 'US') FROM sales`;
        const query = SelectQueryParser.parse(sql);
        const collector = new ColumnReferenceCollector();

        // Act: Collect all column references from the parsed query.
        const columnNames = collector.collect(query).map(getColumnName);

        // Assert: The column mentioned only in the FILTER predicate should still be discovered.
        expect(columnNames).toContain('region');
    });
});

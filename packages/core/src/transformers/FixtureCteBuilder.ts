import { CommonTable, SourceAliasExpression, SelectClause, SelectItem, WhereClause } from '../models/Clause';
import { SimpleSelectQuery } from '../models/SelectQuery';
import { BinarySelectQuery } from '../models/BinarySelectQuery';
import { CastExpression, LiteralValue, TypeValue, RawString, BinaryExpression, ValueComponent } from '../models/ValueComponent';

/** Describes a single column in a fixture used for query rewriting. */
export interface FixtureColumnDefinition {
    name: string;
    typeName?: string;
    defaultValue?: string;
}

/** Defines the data required to represent a fixture table as a CTE. */
export interface FixtureTableDefinition {
    tableName: string;
    columns: FixtureColumnDefinition[];
    rows: (string | number | bigint | Buffer | null)[][];
}

export class FixtureCteBuilder {
    /** Builds CommonTable representations for the provided fixtures. */
    public static buildFixtures(fixtures: FixtureTableDefinition[]): CommonTable[] {
        return fixtures.map((fixture) => this.buildFixture(fixture));
    }

    private static buildFixture(fixture: FixtureTableDefinition): CommonTable {
        const query = this.buildSelectQuery(fixture);
        // Wrap the query into a CommonTable for later WITH clause injection.
        return new CommonTable(query, fixture.tableName, null);
    }

    private static buildSelectQuery(fixture: FixtureTableDefinition): SimpleSelectQuery | BinarySelectQuery {
        const columnCount = fixture.columns.length;
        // Always produce at least one row even when the fixture carries zero entries.
        const rows = fixture.rows.length > 0 ? fixture.rows : [new Array(columnCount).fill(null)];

        const selectQueries = rows.map((row) => this.buildSelectRow(fixture.columns, row));

        if (selectQueries.length === 0) {
            throw new Error('No rows to build SELECT query');
        }

        let result: SimpleSelectQuery | BinarySelectQuery = selectQueries[0];

        // Build UNION ALL chain for multiple rows
        for (let i = 1; i < selectQueries.length; i++) {
            // toUnionAll only exists on SimpleSelectQuery, but result might be BinarySelectQuery after first iteration
            if (result instanceof SimpleSelectQuery) {
                result = result.toUnionAll(selectQueries[i]);
            } else {
                // BinarySelectQuery - need to wrap in a new SimpleSelectQuery and union
                // This shouldn't happen in practice since we start with SimpleSelectQuery
                // and toUnionAll returns BinarySelectQuery
                throw new Error('Unexpected BinarySelectQuery in fixture building');
            }
        }

        // Handle empty fixture case: add WHERE 1 = 0 to make it return no rows
        if (fixture.rows.length === 0 && result instanceof SimpleSelectQuery) {
            const falseCondition = new BinaryExpression(
                new LiteralValue(1),
                '=',
                new LiteralValue(0)
            );
            result.whereClause = new WhereClause(falseCondition);
        }

        return result;
    }

    private static buildSelectRow(columns: FixtureColumnDefinition[], row: (string | number | bigint | Buffer | null)[]): SimpleSelectQuery {
        // Build select items that respect optional type annotations.
        const items = columns.map((column, index) => {
            const value = index < row.length ? row[index] : null;
            const literalValue = this.createLiteralValue(value);

            let expression: ValueComponent = literalValue;

            if (column.typeName) {
                const typeValue = new TypeValue(null, new RawString(column.typeName));
                expression = new CastExpression(literalValue, typeValue);
            }

            return new SelectItem(expression, column.name);
        });

        const selectClause = new SelectClause(items);
        return new SimpleSelectQuery({ selectClause });
    }

    private static createLiteralValue(value: string | number | bigint | Buffer | null | undefined): LiteralValue {
        if (value === null || value === undefined) {
            return new LiteralValue(null);
        }
        if (typeof value === 'number') {
            return new LiteralValue(Number.isFinite(value) ? value : null);
        }
        if (typeof value === 'bigint') {
            // Convert bigint to number or string depending on size
            return new LiteralValue(Number(value));
        }
        if (typeof Buffer !== 'undefined' && value instanceof Buffer) {
            // For Buffer, we'll create a hex string literal
            return new LiteralValue(`X'${value.toString('hex')}'`);
        }
        if (typeof value === 'string') {
            // Store the raw string value WITHOUT quotes or escaping
            // The SqlPrinter will handle escaping when printing
            return new LiteralValue(value, undefined, true);
        }
        return new LiteralValue(String(value), undefined, true);
    }
}
